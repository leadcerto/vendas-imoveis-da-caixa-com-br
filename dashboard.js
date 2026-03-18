// Supabase configuration
const SUPABASE_URL = "https://jefgzdcynnotuiaiickd.supabase.co";
const SUPABASE_KEY = "sb_publishable_s_f-Can7kPxIKjF1uS8E2g_b5vTJY5u";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State
let allLeads = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchLeads();
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

// Close modal when clicking outside
window.onclick = (event) => {
    if (event.target === modal) closeModal();
};

// Handle Edit Form Submission
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
        
        // Refresh data
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
