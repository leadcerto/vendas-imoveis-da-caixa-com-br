// Supabase configuration
const SUPABASE_URL = "https://jefgzdcynnotuiaiickd.supabase.co";
const SUPABASE_KEY = "sb_publishable_s_f-Can7kPxIKjF1uS8E2g_b5vTJY5u";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State
let allLeads = [];
let selectedFile = null;

// DOM Elements
const csvInput = document.getElementById('csvInput');
const dropZone = document.getElementById('dropZone');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const uploadBtn = document.getElementById('uploadBtn');
const importBtn = document.getElementById('importBtn');
const filesList = document.getElementById('filesList');
const csvSource = document.getElementById('csvSource');
const autoImport = document.getElementById('autoImport');
const propertiesBody = document.getElementById('propertiesBody');
const propertiesCount = document.getElementById('propertiesCount');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchLeads();
    fetchFiles();
    fetchProperties();
    setupDragAndDrop();
    setupEventListeners();
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
        leadsBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #ef4444;">Erro ao carregar leads.</td></tr>';
    }
}

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

// Properties Logic
async function fetchProperties() {
    try {
        const { data, count, error } = await _supabase
            .from('properties')
            .select('*', { count: 'exact' })
            .limit(15)
            .order('created_at', { ascending: false });

        if (error) throw error;

        propertiesCount.textContent = `${count || 0} imóveis no banco`;
        renderProperties(data);

    } catch (error) {
        console.error('Erro ao buscar imóveis:', error.message);
        propertiesCount.textContent = 'Erro ao carregar';
    }
}

function renderProperties(properties) {
    if (!properties || properties.length === 0) return;

    propertiesBody.innerHTML = properties.map(p => `
        <tr>
            <td>${p.property_number}</td>
            <td>${p.uf}</td>
            <td>${p.city}</td>
            <td class="notes-cell">${p.neighborhood}</td>
            <td>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price || 0)}</td>
            <td>${p.discount_percentage || 0}%</td>
        </tr>
    `).join('');
}

// CSV Handlers
function setupEventListeners() {
    uploadBtn.addEventListener('click', handleUploadToStorage);
    importBtn.addEventListener('click', handleImportToDatabase);
}

function setupDragAndDrop() {
    if (!dropZone) return;

    dropZone.addEventListener('click', () => csvInput.click());

    csvInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) handleFileSelect(file);
        else alert('Por favor, selecione um arquivo .csv');
    });
}

function handleFileSelect(file) {
    selectedFile = file;
    fileNameDisplay.textContent = `Selecionado: ${file.name}`;
    fileNameDisplay.style.color = '#fff';
    uploadBtn.disabled = false;
    importBtn.disabled = false;

    // Direct path: If auto-import is enabled, start the whole process immediately
    if (autoImport && autoImport.checked) {
        console.log('Auto-import enabled. Starting process...');
        handleProcessAll();
    }
}

async function handleProcessAll() {
    await handleUploadToStorage();
    await handleImportToDatabase();
}

// Storage Upload
async function handleUploadToStorage() {
    if (!selectedFile) return;
    const originalText = uploadBtn.textContent;

    try {
        uploadBtn.textContent = 'Enviando...';
        uploadBtn.disabled = true;

        const now = new Date();
        const timestamp = now.getFullYear().toString() +
            (now.getMonth() + 1).toString().padStart(2, '0') +
            now.getDate().toString().padStart(2, '0') + '_' +
            now.getHours().toString().padStart(2, '0') +
            now.getMinutes().toString().padStart(2, '0') +
            now.getSeconds().toString().padStart(2, '0');
        
        const fileName = `${timestamp}_${selectedFile.name}`;

        const { error } = await _supabase.storage.from('csv-caixa').upload(fileName, selectedFile);
        if (error) throw error;

        uploadBtn.textContent = 'Salvo no Storage!';
        uploadBtn.style.background = '#22c55e';
        
        await fetchFiles();
        setTimeout(() => {
            uploadBtn.textContent = originalText;
            uploadBtn.style.background = '';
            uploadBtn.disabled = false;
        }, 2000);

    } catch (error) {
        alert('Erro no Storage: ' + error.message);
        uploadBtn.textContent = originalText;
        uploadBtn.disabled = false;
    }
}

// Database Import (Streaming)
async function handleImportToDatabase() {
    if (!selectedFile) return;

    const progressDiv = document.getElementById('importProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    try {
        importBtn.disabled = true;
        progressDiv.style.display = 'block';
        progressFill.style.width = '0%';
        
        let count = 0;
        let batch = [];
        const batchSize = 100;
        
        Papa.parse(selectedFile, {
            delimiter: "", // Auto-detect delimiter
            skipEmptyLines: true,
            step: async function(results, parser) {
                count++;
                
                // Skip common junk headers if they exist
                const row = results.data;
                if (!row || row.length < 5) return; 
                
                // Skip if it looks like a header (e.g., first column is not a number)
                if (count < 10 && (row[0].toLowerCase().includes('imóvel') || row[0].toLowerCase().includes('nº'))) {
                    console.log('Skipping header row:', row);
                    return;
                }

                const property = {
                    property_number: row[0]?.trim() || '',
                    uf: row[1]?.trim() || '',
                    city: row[2]?.trim() || '',
                    neighborhood: row[3]?.trim() || '',
                    address: row[4]?.trim() || '',
                    price: parseNumber(row[5]),
                    appraisal_value: parseNumber(row[6]),
                    discount_percentage: parseNumber(row[7]),
                    modality: row[8]?.trim() || '',
                    link_acesso: row[9]?.trim() || '',
                    source: csvSource ? csvSource.value : 'unknown'
                };

                // Basic validation
                if (!property.property_number || isNaN(property.price)) {
                    console.warn('Skipping invalid row:', row);
                    return;
                }

                batch.push(property);

                if (batch.length >= batchSize) {
                    parser.pause();
                    progressText.textContent = `Processando: ${count} linhas...`;
                    const { error } = await _supabase.from('properties').upsert(batch, { onConflict: 'property_number' });
                    if (error) console.error('Error batch upsert:', error);
                    batch = [];
                    parser.resume();
                }
            },
            complete: async function() {
                console.log('Parsing complete. Total rows processed:', count);
                if (batch.length > 0) {
                    const { error } = await _supabase.from('properties').upsert(batch, { onConflict: 'property_number' });
                    if (error) console.error('Error final batch upsert:', error);
                }
                
                progressFill.style.width = '100%';
                progressText.textContent = `Sucesso! Processamento concluído.`;
                
                await fetchProperties();
                setTimeout(() => {
                    progressDiv.style.display = 'none';
                    importBtn.disabled = false;
                }, 3000);
            }
        });

    } catch (error) {
        alert('Erro na importação: ' + error.message);
        importBtn.disabled = false;
    }
}

function parseNumber(val) {
    if (!val) return 0;
    let cleaned = val.toString().trim().replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
}

// Storage List
async function fetchFiles() {
    try {
        const { data, error } = await _supabase.storage.from('csv-caixa').list('', {
            sortBy: { column: 'name', order: 'desc' }
        });
        if (error) throw error;
        renderFilesList(data);
    } catch (error) {
        filesList.innerHTML = '<li class="loading-files">Erro ao carregar arquivos.</li>';
    }
}

function renderFilesList(files) {
    if (!files || files.length === 0) {
        filesList.innerHTML = '<li class="loading-files">Nenhum arquivo no storage.</li>';
        return;
    }
    const validFiles = files.filter(f => f.name !== '.emptyFolderPlaceholder');
    filesList.innerHTML = validFiles.map(file => {
        const nameParts = file.name.split('_');
        const displayFileName = nameParts.length >= 3 ? nameParts.slice(2).join('_') : file.name;
        return `
            <li class="file-item">
                <div class="file-info"><span class="file-name">${displayFileName}</span></div>
                <a href="${getDownloadUrl(file.name)}" target="_blank" class="btn-download">BAIXAR</a>
            </li>
        `;
    }).join('');
}

function getDownloadUrl(fileName) {
    const { data } = _supabase.storage.from('csv-caixa').getPublicUrl(fileName);
    return data.publicUrl;
}

// Modal and Edits
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

window.onclick = (event) => { if (event.target === modal) closeModal(); };

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const name = document.getElementById('editName').value;
    const whatsapp = document.getElementById('editWhatsapp').value;
    const notes = document.getElementById('editNotes').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
        submitBtn.disabled = true;
        const { error } = await _supabase.from('leads').update({ name, whatsapp, notes }).eq('id', id);
        if (error) throw error;
        await fetchLeads();
        setTimeout(() => { closeModal(); submitBtn.disabled = false; }, 1000);
    } catch (error) {
        alert('Erro ao salvar: ' + error.message);
        submitBtn.disabled = false;
    }
});
