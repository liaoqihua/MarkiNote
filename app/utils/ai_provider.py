"""AI API 提供商适配层 — DeepSeek / Kimi (Moonshot)"""
import json
import logging

import requests

logger = logging.getLogger(__name__)

PROVIDERS = {
    'deepseek': {
        'name': 'DeepSeek',
        'base_url': 'https://api.deepseek.com',
        'models': [
            {'id': 'deepseek-v4-pro', 'name': 'DeepSeek-V4 Pro'},
            {'id': 'deepseek-v4-flash', 'name': 'DeepSeek-V4 Flash'},
            {'id': 'deepseek-chat', 'name': 'DeepSeek-V3.2'},
        ]
    },
    'kimi': {
        'name': 'Kimi Code',
        'base_url': 'https://api.kimi.com/coding/v1',
        'models': [
            {'id': 'kimi-for-coding', 'name': 'Kimi Code'},
        ]
    }
}


def get_providers_info():
    return {k: {'name': v['name'], 'models': v['models']} for k, v in PROVIDERS.items()}


def validate_api_key(provider_id, api_key):
    provider = PROVIDERS.get(provider_id)
    if not provider:
        return False, '未知提供商'
    try:
        url = f"{provider['base_url']}/models"
        req_headers = {'Authorization': f'Bearer {api_key}'}
        # Kimi For Coding 仅对白名单内的 Coding Agent 开放，需要伪装为 KimiCLI
        if provider_id == 'kimi':
            req_headers['User-Agent'] = 'KimiCLI/1.3'
        resp = requests.get(url, headers=req_headers, timeout=10)
        if resp.status_code == 200:
            return True, '连接成功'
        elif resp.status_code == 401:
            logger.warning("API Key 验证 401: provider=%s", provider_id)
            return False, 'API Key 无效'
        else:
            logger.warning("API Key 验证失败: provider=%s status=%d", provider_id, resp.status_code)
            return False, f'请求失败: HTTP {resp.status_code}'
    except requests.Timeout:
        logger.warning("API Key 验证超时: provider=%s", provider_id)
        return False, '连接超时'
    except Exception as e:
        logger.exception("API Key 验证异常: provider=%s", provider_id)
        return False, f'连接失败: {str(e)}'


def stream_chat_completion(messages, tools, api_key, provider_id, model_id):
    """
    流式调用 AI API，yield 解析后的事件字典:
      {"type": "content", "content": "..."}
      {"type": "tool_call_start", "index": 0, "id": "...", "name": "..."}
      {"type": "tool_call_args", "index": 0, "arguments": "..."}
      {"type": "done"}
      {"type": "error", "message": "..."}
    """
    provider = PROVIDERS.get(provider_id)
    if not provider:
        logger.error("未知 AI 提供商: %s", provider_id)
        yield {'type': 'error', 'message': f'未知提供商: {provider_id}'}
        return

    url = f"{provider['base_url']}/chat/completions"
    logger.debug("AI API 请求: provider=%s model=%s url=%s", provider_id, model_id, url)
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    # Kimi For Coding 仅对白名单内的 Coding Agent 开放，需要伪装为 KimiCLI
    if provider_id == 'kimi':
        headers['User-Agent'] = 'KimiCLI/1.3'

    body = {
        'model': model_id,
        'messages': messages,
        'stream': True,
        'temperature': 0.7,
    }

    if tools:
        body['tools'] = tools
        body['tool_choice'] = 'auto'

    try:
        resp = requests.post(url, headers=headers, json=body, stream=True, timeout=120)
        if resp.status_code != 200:
            try:
                err = resp.json()
                msg = err.get('error', {}).get('message', resp.text[:200])
            except Exception:
                msg = resp.text[:200]
            logger.error("AI API 响应错误: status=%d provider=%s model=%s msg=%s",
                         resp.status_code, provider_id, model_id, msg[:200])
            yield {'type': 'error', 'message': f'API 错误 ({resp.status_code}): {msg}'}
            return

        resp.encoding = 'utf-8'
        yielded_any = False
        raw_preview = []
        for line in resp.iter_lines(decode_unicode=True):
            if not line:
                continue
            if len(raw_preview) < 5:
                raw_preview.append(line[:200])
            # 兼容 "data: xxx" 和 "data:xxx" 两种 SSE 格式（Kimi 无空格）
            if line.startswith('data: '):
                data_str = line[6:]
            elif line.startswith('data:'):
                data_str = line[5:]
            else:
                # 有些实现会发 event:/id: 行，跳过；记录前几条便于诊断
                continue
            if data_str.strip() == '[DONE]':
                if not yielded_any:
                    yield {'type': 'error', 'message': f'API 返回空流（无 content/reasoning）。原始前几行: {raw_preview}'}
                    return
                yield {'type': 'done'}
                return

            try:
                data = json.loads(data_str)
            except json.JSONDecodeError:
                continue

            choices = data.get('choices', [])
            if not choices:
                continue

            delta = choices[0].get('delta', {})
            finish = choices[0].get('finish_reason')

            if 'content' in delta and delta['content']:
                yielded_any = True
                yield {'type': 'content', 'content': delta['content']}

            if 'reasoning_content' in delta and delta['reasoning_content']:
                yielded_any = True
                yield {'type': 'reasoning', 'content': delta['reasoning_content']}

            if 'tool_calls' in delta:
                for tc in delta['tool_calls']:
                    idx = tc.get('index', 0)
                    if 'id' in tc:
                        yielded_any = True
                        yield {
                            'type': 'tool_call_start',
                            'index': idx,
                            'id': tc['id'],
                            'name': tc.get('function', {}).get('name', '')
                        }
                    if 'function' in tc and 'arguments' in tc['function']:
                        yielded_any = True
                        yield {
                            'type': 'tool_call_args',
                            'index': idx,
                            'arguments': tc['function']['arguments']
                        }

            if finish == 'stop':
                if not yielded_any:
                    yield {'type': 'error', 'message': f'API 返回空流（finish=stop 但无内容）。原始前几行: {raw_preview}'}
                    return
                yield {'type': 'done'}
                return
            elif finish == 'tool_calls':
                yield {'type': 'tool_calls_complete'}

        # 循环自然结束（服务端未发 [DONE] 也未发 finish_reason）
        if not yielded_any:
            yield {'type': 'error', 'message': f'API 未返回任何内容。状态={resp.status_code}，原始前几行: {raw_preview}'}
            return
        yield {'type': 'done'}

    except requests.Timeout:
        logger.error("AI API 请求超时: provider=%s model=%s", provider_id, model_id)
        yield {'type': 'error', 'message': 'API 请求超时（120秒）'}
    except requests.ConnectionError:
        logger.error("AI API 连接失败: provider=%s", provider_id)
        yield {'type': 'error', 'message': '无法连接到 API 服务器，请检查网络'}
    except Exception as e:
        logger.exception("AI API 请求异常: provider=%s model=%s", provider_id, model_id)
        yield {'type': 'error', 'message': f'请求异常: {str(e)}'}
