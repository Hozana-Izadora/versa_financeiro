import React from 'react';
import {
  Wallet, BarChart2, Crosshair, ReceiptText, Network, FileUp,
  X, Sun, Moon, LogOut, ChevronRight, ChevronLeft, Menu, LayoutGrid,
  Download, PlusCircle, Inbox, Pencil, Trash2, TrendingUp, Landmark,
  CreditCard, FolderPlus, Folder, ChevronDown, Plus, Info, AlertTriangle,
  ArrowLeftRight, AlertCircle, FolderOpen, CheckCircle2, Dices, ListX,
  Trash, RefreshCw, Check, History, SlidersHorizontal, XCircle, ArrowLeft,
} from 'lucide-react';

const MAP = {
  account_balance_wallet: Wallet,
  bar_chart: BarChart2,
  gps_fixed: Crosshair,
  receipt_long: ReceiptText,
  account_tree: Network,
  upload_file: FileUp,
  close: X,
  light_mode: Sun,
  dark_mode: Moon,
  logout: LogOut,
  chevron_right: ChevronRight,
  chevron_left: ChevronLeft,
  menu: Menu,
  grid_view: LayoutGrid,
  download: Download,
  add_circle: PlusCircle,
  inbox: Inbox,
  edit: Pencil,
  delete: Trash2,
  trending_up: TrendingUp,
  account_balance: Landmark,
  payments: CreditCard,
  create_new_folder: FolderPlus,
  folder: Folder,
  expand_more: ChevronDown,
  add: Plus,
  info: Info,
  warning: AlertTriangle,
  swap_horiz: ArrowLeftRight,
  error: AlertCircle,
  folder_open: FolderOpen,
  check_circle: CheckCircle2,
  casino: Dices,
  delete_sweep: ListX,
  delete_forever: Trash,
  refresh: RefreshCw,
  check: Check,
  history: History,
  tune: SlidersHorizontal,
  cancel: XCircle,
  arrow_back: ArrowLeft,
};

export default function Icon({ name, size = 'text-[18px]', className = '', style }) {
  const LucideIcon = MAP[name];

  // Parse pixel size from Tailwind class like "text-[18px]" or "text-[26px]"
  const px = (() => {
    const m = size.match(/\[(\d+(?:\.\d+)?)px\]/);
    if (m) return Number(m[1]);
    const named = { 'text-xs': 12, 'text-sm': 14, 'text-base': 16, 'text-lg': 18, 'text-xl': 20, 'text-2xl': 24 };
    return named[size] ?? 18;
  })();

  if (!LucideIcon) return null;

  return (
    <LucideIcon
      size={px}
      className={`shrink-0 select-none ${className}`}
      style={style}
      aria-hidden="true"
      strokeWidth={1.6}
    />
  );
}
