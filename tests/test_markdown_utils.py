import unittest

from app.utils.markdown_utils import process_markdown


class MarkdownUtilsTests(unittest.TestCase):
    def test_table_stops_before_following_heading_without_blank_line(self):
        html = process_markdown('| A | B |\n|---|---|\n| 1 | 2 |\n## after\ntext')

        self.assertIn('</table>', html)
        self.assertIn('<h2 id="after">after</h2>', html)
        self.assertIn('<p>text</p>', html)
        self.assertNotIn('<td>## after</td>', html)

    def test_table_stops_before_following_paragraph_without_blank_line(self):
        html = process_markdown('| A | B |\n|---|---|\n| 1 | 2 |\nplain text')

        self.assertIn('</table>', html)
        self.assertIn('<p>plain text</p>', html)
        self.assertNotIn('<td>plain text</td>', html)

    def test_table_stops_before_following_heading_containing_pipe(self):
        html = process_markdown('| A | B |\n|---|---|\n| 1 | 2 |\n## A | B\ntext')

        self.assertIn('</table>', html)
        self.assertIn('<h2 id="a-b">A | B</h2>', html)
        self.assertIn('<p>text</p>', html)
        self.assertNotIn('<td>## A</td>', html)

    def test_table_stops_before_following_list_item_containing_pipe(self):
        html = process_markdown('| A | B |\n|---|---|\n| 1 | 2 |\n- A | B')

        self.assertIn('</table>', html)
        self.assertIn('<li>A | B</li>', html)
        self.assertNotIn('<td>- A</td>', html)

    def test_table_stops_after_two_dash_alignment_separator(self):
        html = process_markdown(
            '|数据类型|传输方向|隔离传输方式|平台服务进程/组件|\n'
            '|:--:|:--:|:--:|:--:|\n'
            '|实时库数据|I/II->III/IV|TCP单向传输|I/II:cygdataferrycli<br>III/IV:cygdataferrysrv|\n'
            '|分布式文件数据|I/II->III/IV|E文件单向摆渡|I/II:cygfileweb<br>III/IV:cygdataweb|\n'
            '## 3. 架构\n'
            '![diagram](.assets/diagram.png)\n'
            '## 4. 具体的同步内容和同步量'
        )

        self.assertIn('</table>', html)
        self.assertIn('<h2 id="3">3. 架构</h2>', html)
        self.assertIn('<img alt="diagram" src=".assets/diagram.png"', html)
        self.assertIn('<h2 id="4">4. 具体的同步内容和同步量</h2>', html)
        self.assertNotIn('<td style="text-align: center;">## 3. 架构</td>', html)


if __name__ == '__main__':
    unittest.main()
