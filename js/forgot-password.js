/* forgot-password.js — POST /api/users/forgot-password */

const API_BASE_URL = window.getApiBaseUrl();

function parseErrorFromResponse(data) {
    if (!data) return 'Something went wrong. Please try again.';
    if (data.detail) {
        if (Array.isArray(data.detail)) {
            return data.detail.map((err) => err.msg || err.message || 'Validation error').join('. ');
        }
        if (typeof data.detail === 'string') return data.detail;
        return data.detail.message || JSON.stringify(data.detail);
    }
    if (data.message) return data.message;
    return 'Something went wrong. Please try again.';
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgot-form');
    form?.addEventListener('submit', handleForgotPassword);
});

async function handleForgotPassword(event) {
    event.preventDefault();

    const email = document.getElementById('forgot-email').value.trim();
    const btn = document.getElementById('forgot-button');
    const btnText = document.getElementById('forgot-button-text');
    const errEl = document.getElementById('forgot-error');

    errEl.style.display = 'none';
    btn.disabled = true;
    btnText.textContent = 'Sending…';

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });

        const contentType = response.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error(text || 'Request failed. Please try again.');
        }

        if (!response.ok) {
            throw new Error(parseErrorFromResponse(data));
        }

        const msg = data.message;
        if (msg) {
            document.getElementById('forgot-success-message').textContent = msg;
        }
        document.getElementById('forgot-form-wrap').style.display = 'none';
        document.getElementById('forgot-success-wrap').style.display = 'flex';
    } catch (e) {
        console.error(e);
        errEl.textContent = e.message || 'Request failed. Please try again.';
        errEl.style.display = 'block';
        btn.disabled = false;
        btnText.textContent = 'Send reset link';
    }
}
