import Swal from 'sweetalert2';

// Shared SweetAlert2 wrapper — replaces window.confirm/window.alert everywhere with a
// themed modal (follows the app's light/dark mode instead of the browser's native box).
function isDark() {
  return document.documentElement.classList.contains('dark');
}

function themeProps() {
  return {
    background: isDark() ? '#161b22' : '#ffffff',
    color: isDark() ? '#e5e7eb' : '#111827',
    customClass: { popup: 'swal-app-popup' },
  };
}

// Returns true if the user confirmed, false otherwise (cancelled or dismissed).
export async function confirmDialog(text, { title = 'Confirmar', confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false } = {}) {
  const result = await Swal.fire({
    title,
    text,
    icon: danger ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    focusCancel: true,
    confirmButtonColor: danger ? '#ef4444' : '#10b981',
    cancelButtonColor: isDark() ? '#374151' : '#e5e7eb',
    ...themeProps(),
  });
  return result.isConfirmed;
}

export function alertError(text, title = 'Erro') {
  return Swal.fire({
    title, text, icon: 'error', confirmButtonText: 'OK',
    confirmButtonColor: '#ef4444',
    ...themeProps(),
  });
}

export function alertSuccess(text, title = 'Sucesso') {
  return Swal.fire({
    title, text, icon: 'success', confirmButtonText: 'OK',
    confirmButtonColor: '#10b981',
    ...themeProps(),
  });
}
