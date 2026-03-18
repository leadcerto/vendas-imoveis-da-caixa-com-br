// Supabase configuration
const SUPABASE_URL = "https://jefgzdcynnotuiaiickd.supabase.co";
const SUPABASE_KEY = "sb_publishable_s_f-Can7kPxIKjF1uS8E2g_b5vTJY5u";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State
let allLeads = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchLeads();
    fetchFiles();
    setupDragAndDrop();
});

// Fetch leads from Supabase
async function fetchLeads() {
    const leadsCount = document.getElementById('leadsCount');
    const leadsBody = document.getElementById('leadsBody');
    
    try {
        leadsCount.textContent = 'Carregando...';
        
        const { data, error } = await _supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allLeads = data;
        renderLeads(data);
        leadsCount.textContent = `${data.length} leads encontrados`;

    } catch (error) {
        console.error('Erro ao buscar leads:', error.message);
        leadsCount.textContent = 'Erro ao carregar dados';
        leadsBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #ef4444;">Erro ao carregar leads. Verifique o console.</td></tr>';
    }
}

// ... existing lead functions ...

// CSV Management Logic
const csvInput = document.getElementById('csvInput');
const dropZone = document.getElementById('dropZone');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const uploadBtn = document.getElementById('uploadBtn');
const filesList = document.getElementById('filesList');

let selectedFile = null;

// Drag and Drop Setup
function setupDragAndDrop() {
    if (!dropZone) return;

    dropZone.addEventListener('click', () => csvInput.click());

    csvInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        if (file && file.name.endsWith('.csv')) {
            handleFileSelect(file);
        } else {
            alert('Por favor, selecione um arquivo .csv');
        }
    });
}

function handleFileSelect(file) {
    selectedFile = file;
    fileNameDisplay.textContent = `Selecionado: ${file.name}`;
    fileNameDisplay.style.color = '#fff';
    uploadBtn.disabled = false;
}

// Upload Logic
uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    const originalText = uploadBtn.textContent;
    try {
        uploadBtn.textContent = 'Enviando...';
        uploadBtn.disabled = true;

        // Create filename with date prefix: YYYYMMDD_HHMMSS_name
        const now = new Date();
        const timestamp = now.getFullYear().toString() +
            (now.getMonth() + 1).toString().padStart(2, '0') +
            now.getDate().toString().padStart(2, '0') + '_' +
            now.getHours().toString().padStart(2, '0') +
            now.getMinutes().toString().padStart(2, '0') +
            now.getSeconds().toString().padStart(2, '0');
        
        const fileName = `${timestamp}_${selectedFile.name}`;

        const { data, error } = await _supabase.storage
            .from('csv-caixa')
            .upload(fileName, selectedFile);

        if (error) throw error;

        // Success
        uploadBtn.textContent = 'Enviado com Sucesso!';
        uploadBtn.style.background = '#22c55e';
        
        // Reset
        selectedFile = null;
        fileNameDisplay.textContent = 'Arraste seu CSV aqui ou clique para selecionar';
        csvInput.value = '';
        
        await fetchFiles();

        setTimeout(() => {
            uploadBtn.textContent = originalText;
            uploadBtn.style.background = '';
            uploadBtn.disabled = true;
        }, 2000);

    } catch (error) {
        console.error('Erro no upload:', error.message);
        alert('Erro ao enviar arquivo: ' + error.message + '\n\nCertifique-se de que o bucket "csv-caixa" existe no Storage do seu Supabase.');
        uploadBtn.textContent = originalText;
        uploadBtn.disabled = false;
    }
});

// Fetch File List
async function fetchFiles() {
    if (!filesList) return;

    try {
        const { data, error } = await _supabase.storage
            .from('csv-caixa')
            .list('', {
                sortBy: { column: 'name', order: 'desc' }
            });

        if (error) throw error;

        renderFilesList(data);

    } catch (error) {
        console.error('Erro ao listar arquivos:', error.message);
        filesList.innerHTML = '<li class="loading-files">Erro ao carregar lista de arquivos.</li>';
    }
}

function renderFilesList(files) {
    if (!files || files.length === 0) {
        filesList.innerHTML = '<li class="loading-files">Nenhum arquivo enviado ainda na pasta CSV-CAIXA.</li>';
        return;
    }

    // Filter out potential system files like .emptyFolderPlaceholder
    const validFiles = files.filter(f => f.name !== '.emptyFolderPlaceholder');

    if (validFiles.length === 0) {
        filesList.innerHTML = '<li class="loading-files">Nenhum arquivo enviado ainda.</li>';
        return;
    }

    filesList.innerHTML = validFiles.map(file => {
        // Extract original name from prefix (if present)
        const nameParts = file.name.split('_');
        const hasTimestamp = nameParts.length > 1 && nameParts[0].length >= 15;
        const displayName = hasTimestamp ? nameParts.slice(2).join('_') : file.name; // slice(2) because date_time_name
        
        // Since my timestamp logic was YYYYMMDD_HHMMSS_name, parts are [YYYYMMDD, HHMMSS, name]
        const displayFileName = nameParts.length >= 3 ? nameParts.slice(2).join('_') : file.name;
        
        let dateStr = 'Data desconhecida';
        if (nameParts.length >= 2) {
            const d = nameParts[0];
            const t = nameParts[1];
            if (d.length === 8 && t.length === 6) {
                dateStr = `${d.substring(6,8)}/${d.substring(4,6)}/${d.substring(0,4)} ${t.substring(0,2)}:${t.substring(2,4)}`;
            }
        }

        return `
            <li class="file-item">
                <div class="file-info">
                    <span class="file-name">${displayFileName}</span>
                    <span class="file-date">Enviado em: ${dateStr}</span>
                </div>
                <a href="${getDownloadUrl(file.name)}" target="_blank" class="btn-download">BAIXAR</a>
            </li>
        `;
    }).join('');
}

function getDownloadUrl(fileName) {
    const { data } = _supabase.storage
        .from('csv-caixa')
        .getPublicUrl(fileName);
    return data.publicUrl;
}

// ... original renderLeads and modal functions ...

// Render leads table
function renderLeads(leads) {
    const leadsBody = document.getElementById('leadsBody');
    
    if (leads.length === 0) {
        leadsBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: rgba(255,255,255,0.3); padding: 2rem;">Nenhum lead encontrado ainda.</td></tr>';
        return;
    }

    leadsBody.innerHTML = leads.map(lead => `
        <tr>
            <td>${new Date(lead.created_at).toLocaleDateString('pt-BR')} ${new Date(lead.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</td>
            <td>${lead.name || '-'}</td>
            <td>${lead.whatsapp || '-'}</td>
            <td>${lead.email}</td>
            <td class="notes-cell">${lead.notes || '-'}</td>
            <td>
                <button class="btn-edit" onclick="openEditModal('${lead.id}')">EDITAR</button>
            </td>
        </tr>
    `).join('');
}

// Modal Logic
const modal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');

function openEditModal(id) {
    const lead = allLeads.find(l => l.id === id);
    if (!lead) return;

    document.getElementById('editId').value = lead.id;
    document.getElementById('editName').value = lead.name || '';
    document.getElementById('editWhatsapp').value = lead.whatsapp || '';
    document.getElementById('editEmail').value = lead.email;
    document.getElementById('editNotes').value = lead.notes || '';

    modal.classList.add('active');
}

function closeModal() {
    modal.classList.remove('active');
    editForm.reset();
}

window.onclick = (event) => {
    if (event.target === modal) closeModal();
};

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('editId').value;
    const name = document.getElementById('editName').value;
    const whatsapp = document.getElementById('editWhatsapp').value;
    const notes = document.getElementById('editNotes').value;
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    try {
        submitBtn.textContent = 'Salvando...';
        submitBtn.disabled = true;

        const { error } = await _supabase
            .from('leads')
            .update({ name, whatsapp, notes })
            .eq('id', id);

        if (error) throw error;

        submitBtn.textContent = 'Salvo!';
        submitBtn.style.background = '#22c55e';
        
        await fetchLeads();
        
        setTimeout(() => {
            closeModal();
            submitBtn.textContent = originalText;
            submitBtn.style.background = '';
            submitBtn.disabled = false;
        }, 1000);

    } catch (error) {
        console.error('Erro ao atualizar lead:', error.message);
        alert('Erro ao salvar: ' + error.message);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});
