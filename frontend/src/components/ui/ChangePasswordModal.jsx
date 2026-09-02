import React, { useState } from 'react';
import { api } from '../../api/index.js';
import { useApp } from '../../context/AppContext.jsx';
import Icon from './Icon.jsx';

function PasswordField({ label, value, onChange, placeholder, autoFocus }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
          required
          style={{ paddingRight: 38 }}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow(v => !v)}
          title={show ? 'Ocultar senha' : 'Mostrar senha'}
          className="text-text-3 hover:text-text-base transition-colors"
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex',
          }}
        >
          <Icon name={show ? 'visibility_off' : 'visibility'} size="text-[15px]" />
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordModal() {
  const { actions } = useApp();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('A confirmação não bate com a nova senha.');
      return;
    }

    setSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      actions.closeModal();
      actions.notify('Senha alterada com sucesso!', 'ns');
    } catch (err) {
      setError(err.message || 'Não foi possível alterar a senha.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="font-inter font-bold text-base mb-4">Trocar senha</div>

      <PasswordField
        label="Senha atual"
        value={currentPassword}
        onChange={e => setCurrentPassword(e.target.value)}
        autoFocus
      />
      <PasswordField
        label="Nova senha"
        value={newPassword}
        onChange={e => setNewPassword(e.target.value)}
        placeholder="Mínimo 8 caracteres"
      />
      <PasswordField
        label="Confirmar nova senha"
        value={confirmPassword}
        onChange={e => setConfirmPassword(e.target.value)}
      />

      {error && <div className="text-[11.5px] text-red-500 mt-1">{error}</div>}

      <div className="flex gap-2 mt-4">
        <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={actions.closeModal}>Cancelar</button>
      </div>
    </form>
  );
}
