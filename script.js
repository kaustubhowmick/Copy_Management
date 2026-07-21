document.addEventListener('DOMContentLoaded', () => {
    const inputText  = document.getElementById('inputText');
    const addButton  = document.getElementById('addButton');
    const textList   = document.getElementById('textList');
    const searchText = document.getElementById('searchText');
    const sortSelect = document.getElementById('sortSelect');
    const countEl    = document.getElementById('count');
    const emptyState = document.getElementById('emptyState');
    const exportBtn  = document.getElementById('exportBtn');
    const importBtn  = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');
    const toast      = document.getElementById('toast');
    const toastMsg   = document.getElementById('toastMsg');
    const toastAction= document.getElementById('toastAction');

    const STORAGE_KEY = 'texts';

    // State: array of { id, text, createdAt }
    let items = loadItems();

    // ---- Storage --------------------------------------------------------
    function loadItems() {
        let raw;
        try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
        catch { raw = []; }
        return raw.map(entry =>
            typeof entry === 'string'
                ? { id: makeId(), text: entry, createdAt: Date.now() }
                : { createdAt: Date.now(), ...entry }
        );
    }
    function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
    function makeId() {
        return (crypto.randomUUID && crypto.randomUUID()) ||
               Date.now().toString(36) + Math.random().toString(36).slice(2);
    }

    // ---- Toast (with optional undo action) ------------------------------
    let toastTimer;
    function showToast(msg, actionLabel, onAction) {
        toastMsg.textContent = msg;
        clearTimeout(toastTimer);
        if (actionLabel && onAction) {
            toastAction.textContent = actionLabel;
            toastAction.hidden = false;
            toastAction.onclick = () => {
                onAction();
                hideToast();
            };
        } else {
            toastAction.hidden = true;
            toastAction.onclick = null;
        }
        toast.classList.add('show');
        toastTimer = setTimeout(hideToast, actionLabel ? 5000 : 1600);
    }
    function hideToast() { toast.classList.remove('show'); }

    // ---- Rendering ------------------------------------------------------
    function orderedItems() {
        const mode = sortSelect.value;
        const list = [...items];
        switch (mode) {
            case 'newest': return list.sort((a, b) => b.createdAt - a.createdAt);
            case 'oldest': return list.sort((a, b) => a.createdAt - b.createdAt);
            case 'az':     return list.sort((a, b) => a.text.localeCompare(b.text));
            case 'za':     return list.sort((a, b) => b.text.localeCompare(a.text));
            default:       return list; // manual (matches items array order)
        }
    }

    function buildRow(item) {
        const manual = sortSelect.value === 'manual';
        const li = document.createElement('li');
        li.dataset.id = item.id;
        li.draggable = manual;
        if (!manual) li.classList.add('sorted-view');

        const handle = document.createElement('span');
        handle.className = 'handle';
        handle.textContent = '⠿';
        handle.title = manual ? 'Drag to reorder' : 'Switch to Custom order to reorder';

        const span = document.createElement('span');
        span.className = 'text';
        span.textContent = item.text;
        span.title = new Date(item.createdAt).toLocaleString();

        const actions = document.createElement('div');
        actions.className = 'actions';

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'copy-button';
        copyBtn.textContent = 'Copy';

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'delete-button';
        delBtn.textContent = 'Delete';

        actions.append(copyBtn, delBtn);
        li.append(handle, span, actions);
        return li;
    }

    function render() {
        const frag = document.createDocumentFragment();
        orderedItems().forEach(item => frag.appendChild(buildRow(item)));
        textList.replaceChildren(frag);
        applyFilter();
        updateMeta();
    }

    function updateMeta() {
        const n = items.length;
        countEl.textContent = `${n} item${n === 1 ? '' : 's'}`;
        emptyState.style.display = n === 0 ? 'block' : 'none';
    }

    function applyFilter() {
        const q = searchText.value.trim().toLowerCase();
        textList.querySelectorAll('li').forEach(li => {
            const match = li.querySelector('.text').textContent.toLowerCase().includes(q);
            li.style.display = match ? '' : 'none';
        });
    }

    // ---- Actions --------------------------------------------------------
    function addItem() {
        const text = inputText.value.trim();
        if (!text) return;
        const dup = items.some(it => it.text === text);
        items.push({ id: makeId(), text, createdAt: Date.now() });
        persist();
        render();
        inputText.value = '';
        inputText.focus();
        if (dup) showToast('Added (duplicate of an existing item)');
    }

    function deleteItem(id) {
        const index = items.findIndex(it => it.id === id);
        if (index === -1) return;
        const [removed] = items.splice(index, 1);
        persist();
        render();
        showToast('Deleted', 'Undo', () => {
            items.splice(Math.min(index, items.length), 0, removed);
            persist();
            render();
        });
    }

    function startEdit(li, id) {
        if (li.querySelector('.edit-input')) return;
        const item = items.find(it => it.id === id);
        if (!item) return;
        const span = li.querySelector('.text');

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'edit-input';
        input.value = item.text;
        span.replaceWith(input);
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);

        let done = false;
        const commit = (save) => {
            if (done) return;
            done = true;
            const val = input.value.trim();
            if (save && val) {
                item.text = val;
                persist();
            }
            render();
        };
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') commit(true);
            else if (e.key === 'Escape') commit(false);
        });
        input.addEventListener('blur', () => commit(true));
    }

    // ---- Event delegation ----------------------------------------------
    textList.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (!li) return;
        const id = li.dataset.id;

        if (e.target.classList.contains('copy-button')) {
            const text = li.querySelector('.text').textContent;
            navigator.clipboard.writeText(text).then(() => {
                const btn = e.target;
                btn.textContent = 'Copied ✓';
                btn.classList.add('copied');
                setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1200);
            }).catch(() => showToast('Copy failed'));
        } else if (e.target.classList.contains('delete-button')) {
            deleteItem(id);
        }
    });

    textList.addEventListener('dblclick', (e) => {
        const li = e.target.closest('li');
        if (!li || e.target.closest('.actions') || e.target.closest('.handle')) return;
        startEdit(li, li.dataset.id);
    });

    // ---- Drag to reorder ------------------------------------------------
    let dragId = null;
    textList.addEventListener('dragstart', (e) => {
        if (sortSelect.value !== 'manual') { e.preventDefault(); return; }
        const li = e.target.closest('li');
        if (!li) return;
        dragId = li.dataset.id;
        li.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });
    textList.addEventListener('dragend', (e) => {
        const li = e.target.closest('li');
        if (li) li.classList.remove('dragging');
        dragId = null;
    });
    textList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const after = getDragAfter(e.clientY);
        const dragging = textList.querySelector('.dragging');
        if (!dragging) return;
        if (after == null) textList.appendChild(dragging);
        else textList.insertBefore(dragging, after);
    });
    textList.addEventListener('drop', (e) => {
        if (sortSelect.value !== 'manual') return;
        e.preventDefault();
        // Rebuild items array from current DOM order (manual order is the saved order)
        const order = [...textList.querySelectorAll('li')].map(li => li.dataset.id);
        items.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        persist();
        updateMeta();
    });
    function getDragAfter(y) {
        const rows = [...textList.querySelectorAll('li:not(.dragging)')];
        return rows.reduce((closest, row) => {
            const box = row.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset)
                return { offset, element: row };
            return closest;
        }, { offset: -Infinity, element: null }).element;
    }

    // ---- Export / Import ------------------------------------------------
    exportBtn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `texts-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Exported');
    });

    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', () => {
        const file = importFile.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(reader.result);
                if (!Array.isArray(parsed)) throw new Error('Not a list');
                const cleaned = parsed
                    .map(entry => typeof entry === 'string'
                        ? { id: makeId(), text: entry, createdAt: Date.now() }
                        : { id: entry.id || makeId(), text: String(entry.text ?? ''), createdAt: entry.createdAt || Date.now() })
                    .filter(it => it.text.trim() !== '');
                if (!cleaned.length) throw new Error('No valid items');

                const replace = items.length === 0 ||
                    confirm(`Import ${cleaned.length} item(s)?\n\nOK = replace current list\nCancel = merge (append) instead`);
                if (replace) {
                    items = cleaned;
                } else {
                    const existingIds = new Set(items.map(i => i.id));
                    cleaned.forEach(it => { if (existingIds.has(it.id)) it.id = makeId(); });
                    items = items.concat(cleaned);
                }
                persist();
                render();
                showToast(`Imported ${cleaned.length} item(s)`);
            } catch (err) {
                showToast('Import failed: invalid file');
            }
            importFile.value = '';
        };
        reader.readAsText(file);
    });

    // ---- Wiring ---------------------------------------------------------
    addButton.addEventListener('click', addItem);
    inputText.addEventListener('keydown', (e) => { if (e.key === 'Enter') addItem(); });
    searchText.addEventListener('input', applyFilter);
    sortSelect.addEventListener('change', render);

    render();
});
