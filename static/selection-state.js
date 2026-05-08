(function (root) {
    function normalizePath(path) {
        return String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    }

    function isDeletedPath(selectedPath, deletedPath, deletedType) {
        const selected = normalizePath(selectedPath);
        const deleted = normalizePath(deletedPath);
        if (!selected || !deleted) return false;
        if (selected === deleted) return true;
        return deletedType === 'folder' && selected.startsWith(deleted + '/');
    }

    function pruneSelectionAfterDelete(selectedPaths, deletedPath, deletedType) {
        return Array.from(selectedPaths || []).filter(
            selectedPath => !isDeletedPath(selectedPath, deletedPath, deletedType)
        );
    }

    const api = {
        normalizePath,
        isDeletedPath,
        pruneSelectionAfterDelete,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.MarkiNoteSelectionState = api;
})(typeof window !== 'undefined' ? window : globalThis);
