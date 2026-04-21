/* reset-password.js — POST /api/users/reset-password */

const API_BASE_URL = window.getApiBaseUrl();

function getResetTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || params.get('reset_token') || '';
}

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

function validatePasswordPair(password, confirmPassword) {
    if (!password || password.length < 8) {
        return 'Password must be at least 8 characters long.';
    }
    if (!password.match(/[A-Z]/)) {
        return 'Password must contain at least one uppercase letter.';
    }
    if (password !== confirmPassword) {
        return 'Passwords do not match.';
    }
    return null;
}

function validatePasswordMatch() {
    const password = document.getElementById('reset-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;
    const confirmField = document.getElementById('reset-confirm-password');
    if (confirmPassword && password !== confirmPassword) {
        confirmField.setCustomValidity('Passwords do not match');
    } else {
        confirmField.setCustomValidity('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const token = getResetTokenFromUrl();
    if (!token) {
        document.getElementById('reset-invalid-wrap').style.display = 'flex';
        return;
    }
    document.getElementById('reset-form-wrap').style.display = 'flex';

    document.getElementById('reset-confirm-password')?.addEventListener('input', validatePasswordMatch);
    document.getElementById('reset-password')?.addEventListener('input', validatePasswordMatch);
    document.getElementById('reset-form')?.addEventListener('submit', (e) => handleResetPassword(e, token));
});

async function handleResetPassword(event, token) {
    event.preventDefault();

    const password = document.getElementById('reset-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;
    const btn = document.getElementById('reset-button');
    const btnText = document.getElementById('reset-button-text');
    const errEl = document.getElementById('reset-error');

    const validationError = validatePasswordPair(password, confirmPassword);
    if (validationError) {
        errEl.textContent = validationError;
        errEl.style.display = 'block';
        return;
    }

    errEl.style.display = 'none';
    btn.disabled = true;
    btnText.textContent = 'Updating…';

    try {
        const response = await fetch(`${API_BASE_URL}/api/users/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, new_password: password }),
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

        if (data.message) {
            document.getElementById('reset-success-message').textContent = data.message;
        }
        document.getElementById('reset-form-wrap').style.display = 'none';
        document.getElementById('reset-success-wrap').style.display = 'flex';
    } catch (e) {
        console.error(e);
        errEl.textContent = e.message || 'Request failed. Please try again.';
        errEl.style.display = 'block';
        btn.disabled = false;
        btnText.textContent = 'Update password';
    }
}
