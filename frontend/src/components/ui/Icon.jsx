import React from 'react';
import {
  Wallet, BarChart2, Crosshair, ReceiptText, Network, FileUp,
  X, Sun, Moon, LogOut, ChevronRight, ChevronLeft, Menu, LayoutGrid,
  Download, PlusCircle, Inbox, Pencil, Trash2, TrendingUp, Landmark,
  CreditCard, FolderPlus, Folder, ChevronDown, Plus, Info, AlertTriangle,
  ArrowLeftRight, AlertCircle, FolderOpen, CheckCircle2, Dices, ListX,
  Trash, RefreshCw, Check, History, SlidersHorizontal, XCircle, ArrowLeft,
  Eye, EyeOff, Mail, Lock, LogIn, Building2, ShieldCheck, UserPlus, Users,
  MinusCircle, Target, Search,
} from 'lucide-react';

const MAP = {
  // Navigation / layout
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
  arrow_back: ArrowLeft,

  // Actions
  download: Download,
  add_circle: PlusCircle,
  add_circle_outline: PlusCircle,
  add: Plus,
  edit: Pencil,
  delete: Trash2,
  delete_sweep: ListX,
  delete_forever: Trash,
  refresh: RefreshCw,
  autorenew: RefreshCw,
  check: Check,
  cancel: XCircle,

  // Auth / users
  visibility: Eye,
  visibility_off: EyeOff,
  mail: Mail,
  lock: Lock,
  login: LogIn,
  person_add: UserPlus,
  group: Users,
  admin_panel_settings: ShieldCheck,

  // Business / finance
  business: Building2,
  trending_up: TrendingUp,
  account_balance: Landmark,
  payments: CreditCard,
  insert_chart: BarChart2,
  swap_horiz: ArrowLeftRight,

  // Folders
  create_new_folder: FolderPlus,
  folder: Folder,
  folder_open: FolderOpen,

  // Misc UI
  expand_more: ChevronDown,
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  error_outline: AlertCircle,
  check_circle: CheckCircle2,
  casino: Dices,
  history: History,
  tune: SlidersHorizontal,
  search: Search,
  inbox: Inbox,
  remove_circle_outline: MinusCircle,
  gps_not_fixed: Target,
};

export default function Icon({ name, size = 'text-[18px]', className = '', style }) {
  const LucideIcon = MAP[name];

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
