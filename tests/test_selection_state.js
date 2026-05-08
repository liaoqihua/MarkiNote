const assert = require('assert');
const { pruneSelectionAfterDelete } = require('../static/selection-state.js');

assert.deepStrictEqual(
  pruneSelectionAfterDelete(['a.md', 'b.md'], 'a.md', 'file'),
  ['b.md'],
  '删除单个已勾选文件后，应清除该文件的批量导出选中状态'
);

assert.deepStrictEqual(
  pruneSelectionAfterDelete(['docs/a.md', 'docs/sub/b.md', 'other.md'], 'docs', 'folder'),
  ['other.md'],
  '删除文件夹后，应清除该文件夹内所有已勾选文件的状态'
);

console.log('selection-state tests passed');
