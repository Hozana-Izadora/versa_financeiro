import React from 'react';
import { useApp } from '../../context/AppContext.jsx';
import Icon from './Icon.jsx';

const ICONS = { ns: 'check_circle', ne: 'cancel', ni: 'info' };
const ICON_COLORS = { ns: '#10b981', ne: '#ef4444', ni: '#2563eb' };

export default function Notification() {
  const { state } = useApp();
  const { notification } = state;

  return (
    <div className={`notif ${notification ? notification.cls + ' show' : ''}`}>
      <Icon
        name={ICONS[notification?.cls] || 'info'}
        size="text-[18px]"
        style={{ color: ICON_COLORS[notification?.cls] || '#2563eb' }}
      />
      <span className="text-xs text-text-base">{notification?.msg}</span>
    </div>
  );
}
