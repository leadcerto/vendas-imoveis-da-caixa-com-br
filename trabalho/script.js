// Supabase configuration
const SUPABASE_URL = "https://jefgzdcynnotuiaiickd.supabase.co";
const SUPABASE_KEY = "sb_publishable_s_f-Can7kPxIKjF1uS8E2g_b5vTJY5u";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.getElementById('notifyForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const name = formData.get('name');
    const whatsapp = formData.get('whatsapp');
    const email = formData.get('email');
    
    const button = this.querySelector('button');
    const originalText = button.textContent;

    try {
        button.textContent = 'Enviando...';
        button.disabled = true;

        // Save to Supabase
        const { data, error } = await _supabase
            .from('leads')
            .insert([{ name, whatsapp, email }]);

        if (error) throw error;

        // Success effect
        button.textContent = 'Sucesso!';
        button.style.background = '#22c55e';
        this.reset();
        
        console.log('Lead salvo com sucesso:', { name, whatsapp, email });

    } catch (error) {
        console.error('Erro ao salvar lead:', error.message);
        button.textContent = 'Erro ao enviar';
        button.style.background = '#ef4444';
    } finally {
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
            button.disabled = false;
        }, 3000);
    }
});

// Cursor glow effect
document.addEventListener('mousemove', (e) => {
    const card = document.querySelector('.glass-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
});
