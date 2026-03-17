document.getElementById('notifyForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = this.querySelector('input').value;
    const button = this.querySelector('button');
    const originalText = button.textContent;

    // Efeito de sucesso visual
    button.textContent = 'Enviado!';
    button.style.background = '#22c55e'; // Verde de sucesso
    this.querySelector('input').value = '';
    this.querySelector('input').disabled = true;

    console.log('E-mail capturado:', email);

    setTimeout(() => {
        button.textContent = originalText;
        button.style.background = '';
        this.querySelector('input').disabled = false;
    }, 3000);
});

// Adicionar um leve efeito de brilho seguindo o mouse
document.addEventListener('mousemove', (e) => {
    const card = document.querySelector('.glass-card');
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
});
