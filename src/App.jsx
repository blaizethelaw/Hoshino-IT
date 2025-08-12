import React, { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { 
  Search, Bell, User, ChevronDown, FileText, Settings, BarChart2, LifeBuoy, LogOut, 
  PlusCircle, Filter, Clock, Shield, ArrowRight, X, 
  Info, CheckCircle, List, Grid, Sparkles, BrainCircuit, Loader, AlertTriangle, Activity,
  Package, Key, Laptop, Mail, UserPlus, CheckCircle2, XCircle, RefreshCw, AlertCircle,
  Calendar, HardDrive, BookOpen, Zap, Home, Inbox, ChevronRight, Menu, ArrowLeft
} from 'lucide-react';

// ==================== Enhanced Mock Data ====================
const USERS = {
  'user-1': { id: 'user-1', name: 'Jill Cohen', role: 'End-User', email: 'jill.cohen@hoshino-usa.com', department: 'Sales', avatar: 'JC', assets: ['LAPTOP-001', 'PHONE-001'] },
  'user-2': { id: 'user-2', name: 'Blaize Lough', role: 'Admin', email: 'blaize.lough@hoshino-usa.com', department: 'IT', avatar: 'BL' },
  'user-3': { id: 'user-3', name: 'Shogo Hayashi', role: 'End-User', email: 'shogo.hayashi@hoshino-usa.com', department: 'Marketing', avatar: 'SH', assets: ['LAPTOP-002'] },
  'user-4': { id: 'user-4', name: 'Lisa Talon', role: 'End-User', email: 'lisa.talon@hoshino-usa.com', department: 'HR', avatar: 'LT', isManager: true, assets: ['LAPTOP-003'] },
};

const SERVICE_CATALOG = [
  { id: 'sc-1', name: 'Software License Request', icon: Package, category: 'Software', description: 'Request new software licenses or renewals', approvalRequired: true },
  { id: 'sc-2', name: 'Hardware Request', icon: Laptop, category: 'Hardware', description: 'Request new hardware or replacements', approvalRequired: true },
  { id: 'sc-3', name: 'Access Request', icon: Key, category: 'Access', description: 'Request access to systems or applications', approvalRequired: true },
  { id: 'sc-4', name: 'New Employee Onboarding', icon: UserPlus, category: 'HR IT', description: 'Complete IT setup for new employees', approvalRequired: false },
  { id: 'sc-5', name: 'Email Configuration', icon: Mail, category: 'Communication', description: 'Setup email accounts or distribution lists', approvalRequired: false },
];

const KNOWLEDGE_BASE_ARTICLES = [
  { id: 'kb-1', title: 'How to Reset Your Password', content: 'Step 1: Go to the login page. Step 2: Click "Forgot Password". Step 3: Follow the on-screen instructions.', keywords: 'password, reset, forgot, account' },
  { id: 'kb-2', title: 'Connecting to the Corporate VPN', content: 'Ensure you have the latest VPN client installed. Enter vpn.hoshino-usa.com as the server address and use your standard credentials to connect.', keywords: 'vpn, connection, remote, access' },
  { id: 'kb-3', title: 'Requesting New Software', content: 'All software requests must go through the IT Service Portal. Navigate to Service Catalog > Software License Request.', keywords: 'software, request, install, new' },
  { id: 'kb-4', title: 'Setting up your new MacBook', content: 'Your MacBook comes with MDM pre-configured. Follow the initial setup assistant and sign in with your corporate Apple ID.', keywords: 'macbook, apple, setup, new' },
];

const ASSETS = {
  'LAPTOP-001': { id: 'LAPTOP-001', type: 'Laptop', model: 'Dell Latitude 5520', assignedTo: 'user-1', purchaseDate: '2024-01-15', warrantyExpiry: '2027-01-15', status: 'Active' },
  'LAPTOP-002': { id: 'LAPTOP-002', type: 'Laptop', model: 'MacBook Pro 14"', assignedTo: 'user-3', purchaseDate: '2024-03-20', warrantyExpiry: '2027-03-20', status: 'Active' },
  'LAPTOP-003': { id: 'LAPTOP-003', type: 'Laptop', model: 'ThinkPad X1 Carbon', assignedTo: 'user-4', purchaseDate: '2024-02-10', warrantyExpiry: '2027-02-10', status: 'Active' },
  'PHONE-001': { id: 'PHONE-001', type: 'Phone', model: 'iPhone 13', assignedTo: 'user-1', purchaseDate: '2024-01-15', warrantyExpiry: '2026-01-15', status: 'Active' },
};

let initialTickets = [
    { id: 1, type: 'Incident', subject: 'VPN is not connecting on my MacBook', description: 'I keep getting a "Connection Failed" error when I try to connect to the VPN from my new MacBook. I\'ve tried restarting my machine.', requesterId: 'user-3', agentId: 'user-2', category: 'Software > VPN', priority: 'High', status: 'Open', createdAt: '2025-08-08T10:00:00Z', updatedAt: '2025-08-08T10:00:00Z', slaDeadline: '2025-08-08T18:00:00Z', affectedAssets: ['LAPTOP-002'], comments: [{ authorId: 'user-3', text: 'This is urgent, I need to access files for a client presentation.', isPrivate: false, timestamp: '2025-08-08T10:05:00Z' }] },
    { id: 2, type: 'Service Request', subject: 'Request for Adobe Photoshop License', description: 'I need a license for Adobe Photoshop for the upcoming marketing campaign. Business justification: Creating new ad creatives.', requesterId: 'user-3', agentId: 'user-2', category: 'Software > Licensing', priority: 'Medium', status: 'Pending Approval', createdAt: '2025-08-07T14:30:00Z', updatedAt: '2025-08-07T14:30:00Z', slaDeadline: '2025-08-08T14:30:00Z', comments: [] },
    { id: 3, type: 'Incident', subject: 'Email is running very slow', description: 'My Outlook client has been extremely slow for the past day. It takes minutes to open an email.', requesterId: 'user-1', agentId: 'user-2', category: 'Software > Email', priority: 'High', status: 'In Progress', createdAt: '2025-08-08T09:15:00Z', updatedAt: '2025-08-08T11:00:00Z', slaDeadline: '2025-08-08T17:15:00Z', affectedAssets: ['LAPTOP-001'], comments: [{ authorId: 'user-2', text: 'Checking server logs for any performance issues. Have you tried accessing email via the web client?', isPrivate: true, timestamp: '2025-08-08T11:00:00Z' }] },
    { id: 4, type: 'Service Request', subject: 'Onboard new employee: Ben Carter', description: 'Please set up a new account and laptop for our new Sales team member, Ben Carter. He starts next Monday.', requesterId: 'user-4', agentId: null, category: 'Hardware > New Employee', priority: 'Medium', status: 'Open', createdAt: '2025-08-06T16:00:00Z', updatedAt: '2025-08-06T16:00:00Z', slaDeadline: '2025-08-07T16:00:00Z', comments: [] },
    { id: 5, type: 'Incident', subject: 'Printer on 3rd floor is not working', description: 'The main printer on the 3rd floor is showing a paper jam error, but there is no paper jam.', requesterId: 'user-1', agentId: 'user-2', category: 'Hardware > Printer', priority: 'Low', status: 'Resolved', createdAt: '2025-08-05T11:00:00Z', updatedAt: '2025-08-05T15:00:00Z', slaDeadline: '2025-08-07T11:00:00Z', comments: [{ authorId: 'user-2', text: 'Performed a hard reset on the printer. It is now back online.', isPrivate: false, timestamp: '2025-08-05T14:55:00Z' }, { authorId: 'user-1', text: 'Thanks! It works now.', isPrivate: false, timestamp: '2025-08-05T15:00:00Z' }] },
    { id: 6, type: 'Service Request', subject: 'Access to Marketing shared drive', description: 'I need access to the main marketing shared drive for the Q3 campaign files.', requesterId: 'user-3', agentId: 'user-2', category: 'Access > Shared Drive', priority: 'Low', status: 'Closed', createdAt: '2025-08-04T10:00:00Z', updatedAt: '2025-08-04T10:30:00Z', slaDeadline: '2025-08-06T10:00:00Z', comments: [{ authorId: 'user-2', text: 'Access has been granted.', isPrivate: false, timestamp: '2025-08-04T10:30:00Z' }] },
];

const CATEGORIES = {
  Incident: ['Software > VPN', 'Software > Email', 'Hardware > Printer', 'Hardware > Laptop', 'Network > Connectivity'],
  'Service Request': ['Software > Licensing', 'Hardware > New Employee', 'Access > Shared Drive', 'Access > New Account', 'Hardware > Peripheral Request'],
};

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const STATUSES = ['Open', 'In Progress', 'Pending Approval', 'Awaiting User', 'Resolved', 'Closed'];

const SLA_CONFIG = {
  'Urgent': { resolution: 4 },
  'High': { resolution: 8 },
  'Medium': { resolution: 24 },
  'Low': { resolution: 48 }
};

// ==================== Enhanced Context Provider ====================
const AppContext = createContext();

const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(USERS['user-2']);
  const [tickets, setTickets] = useState([]);
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const loadTickets = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'tickets'));
        if (!snapshot.empty) {
          const ticketData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setTickets(ticketData);
        } else {
          setTickets(initialTickets);
        }
      } catch (err) {
        console.error('Failed to load tickets', err);
        setTickets(initialTickets);
      }
    };
    loadTickets();
  }, []);


  const addNotification = useCallback((type, message) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  const calculateSLAStatus = useCallback((ticket) => {
    if (!ticket.slaDeadline || ticket.status === 'Resolved' || ticket.status === 'Closed') return 'Met';
    const deadline = new Date(ticket.slaDeadline);
    const now = new Date();
    const hoursRemaining = (deadline - now) / (1000 * 60 * 60);
    if (hoursRemaining < 0) return 'Breached';
    if (hoursRemaining < 2) return 'At Risk';
    return 'On Track';
  }, []);

  const createTicket = useCallback(async (newTicketData) => {
    let agentId = null;
    if (newTicketData.category.toLowerCase().includes('network') || newTicketData.category.toLowerCase().includes('vpn')) {
      agentId = 'user-2';
      addNotification('info', `Ticket auto-assigned to Blaize Lough`);
    }

    const newTicket = {
      ...newTicketData,
      requesterId: currentUser.id,
      agentId: agentId,
      status: 'Open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slaDeadline: new Date(Date.now() + SLA_CONFIG[newTicketData.priority].resolution * 60 * 60 * 1000).toISOString(),
      comments: [],
    };
    const docRef = await addDoc(collection(db, 'tickets'), newTicket);
    setTickets(prevTickets => [{ id: docRef.id, ...newTicket }, ...prevTickets]);
    addNotification('success', `Ticket #${docRef.id} created`);
    setActiveView('tickets');
    setSelectedTicketId(docRef.id);
  }, [currentUser, addNotification]);

  const updateTicket = useCallback((ticketId, updates) => {
    setTickets(prevTickets =>
      prevTickets.map(ticket =>
        ticket.id === ticketId ? { ...ticket, ...updates, updatedAt: new Date().toISOString() } : ticket
      )
    );
  }, []);
  
  const addComment = useCallback((ticketId, commentText, isPrivate) => {
      setTickets(prevTickets =>
          prevTickets.map(ticket => {
              if (ticket.id === ticketId) {
                  const newComment = {
                      authorId: currentUser.id,
                      text: commentText,
                      isPrivate: isPrivate,
                      timestamp: new Date().toISOString(),
                  };
                  return { ...ticket, comments: [...ticket.comments, newComment], updatedAt: new Date().toISOString() };
              }
              return ticket;
          })
      );
  }, [currentUser]);

  const switchUser = useCallback(() => {
    const userKeys = Object.keys(USERS);
    const currentUserIndex = userKeys.findIndex(key => key === currentUser.id);
    const nextUserIndex = (currentUserIndex + 1) % userKeys.length;
    setCurrentUser(USERS[userKeys[nextUserIndex]]);
    setActiveView('dashboard');
    setSelectedTicketId(null);
  }, [currentUser]);

  const value = {
    currentUser, tickets, createTicket, updateTicket, addComment, activeView, setActiveView,
    selectedTicketId, setSelectedTicketId, switchUser, notifications, addNotification, calculateSLAStatus,
    assets: ASSETS, serviceCatalog: SERVICE_CATALOG, knowledgeBase: KNOWLEDGE_BASE_ARTICLES,
    searchQuery, setSearchQuery, isMobileMenuOpen, setMobileMenuOpen
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

const useApp = () => useContext(AppContext);

// ==================== UI Components ====================
const Card = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, icon: Icon = null }) => {
  const baseStyles = 'px-4 py-2 rounded-md font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 flex items-center justify-center gap-2';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-400',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 focus:ring-gray-500 disabled:bg-gray-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-400',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 disabled:text-gray-400'
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyles} ${variants[variant]} ${className}`}>
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
};

const StatusBadge = ({ status }) => {
  const statusConfig = {
    'Open': { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-800 dark:text-blue-300', icon: Inbox },
    'In Progress': { bg: 'bg-yellow-100 dark:bg-yellow-900/50', text: 'text-yellow-800 dark:text-yellow-300', icon: RefreshCw },
    'Pending Approval': { bg: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-800 dark:text-purple-300', icon: Clock },
    'Awaiting User': { bg: 'bg-orange-100 dark:bg-orange-900/50', text: 'text-orange-800 dark:text-orange-300', icon: User },
    'Resolved': { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-800 dark:text-green-300', icon: CheckCircle },
    'Closed': { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-300', icon: XCircle },
  };
  const config = statusConfig[status] || statusConfig['Open'];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
      <Icon size={12} className="mr-1" />
      {status}
    </span>
  );
};

const SLAIndicator = ({ ticket }) => {
  const { calculateSLAStatus } = useApp();
  const status = calculateSLAStatus(ticket);
  const config = {
    'On Track': { color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle2 },
    'At Risk': { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: AlertTriangle },
    'Breached': { color: 'text-red-600', bg: 'bg-red-100', icon: XCircle },
    'Met': { color: 'text-blue-600', bg: 'bg-blue-100', icon: CheckCircle }
  };
  const { color, bg, icon: Icon } = config[status] || config['On Track'];
  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${bg} ${color}`}>
      <Icon size={12} className="mr-1" />
      SLA {status}
    </span>
  );
};

const NotificationContainer = () => {
  const { notifications } = useApp();
  const iconMap = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info };
  const colorMap = { success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-500', info: 'bg-blue-500' };
  return (
    <div className="fixed top-20 right-4 z-50 space-y-2">
      {notifications.map(n => {
        const Icon = iconMap[n.type];
        return (
          <div key={n.id} className={`${colorMap[n.type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-in`}>
            <Icon size={20} />
            <span className="text-sm font-medium">{n.message}</span>
          </div>
        );
      })}
    </div>
  );
};

// ==================== Layout Components ====================
const Header = () => {
  const { currentUser, switchUser, searchQuery, setSearchQuery, setMobileMenuOpen } = useApp();
  return (
    <header className="bg-white dark:bg-gray-800/50 backdrop-blur-sm shadow-sm sticky top-0 z-40">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <button onClick={() => setMobileMenuOpen(true)} className="lg:hidden mr-4 p-2 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
                <Menu />
            </button>
            <img src="https://i.imgur.com/UrYHCDu.png" alt="Hoshino Logo" className="h-8 w-auto" />
            <span className="ml-3 text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Hoshino IT</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative hidden md:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400" /></div>
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm" />
            </div>
            <div className="relative group">
              <button onClick={switchUser} className="flex items-center gap-2 text-left p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">{currentUser.avatar}</div>
                <div className="hidden md:block">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{currentUser.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{currentUser.role}</p>
                </div>
                <ChevronDown size={16} className="text-gray-400 hidden md:block" />
              </button>
              <div className="absolute top-full right-0 mt-2 p-2 bg-white dark:bg-gray-800 rounded-md shadow-lg text-xs text-gray-500 dark:text-gray-400 w-48 text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Click to switch user
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

const Sidebar = ({ isMobile = false }) => {
  const { activeView, setActiveView, setMobileMenuOpen } = useApp();
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'tickets', label: 'Tickets', icon: FileText },
    { id: 'service-catalog', label: 'Service Catalog', icon: Package },
    { id: 'kb', label: 'Knowledge Base', icon: BookOpen },
    { id: 'assets', label: 'Assets', icon: HardDrive },
    { id: 'reports', label: 'Analytics', icon: BarChart2 },
    { id: 'automation', label: 'Automation', icon: Zap },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (view) => {
    setActiveView(view);
    if(isMobile) {
        setMobileMenuOpen(false);
    }
  }

  return (
    <aside className={`w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 flex flex-col`}>
       <div className="flex flex-col p-4 space-y-1 flex-grow">
        {isMobile && (
            <div className="flex justify-between items-center mb-4">
                <span className="text-xl font-bold">Menu</span>
                <button onClick={() => setMobileMenuOpen(false)}><X /></button>
            </div>
        )}
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
              activeView === item.id
                ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <item.icon size={18} className="mr-3" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
};

// ==================== Page/View Components ====================
const Dashboard = () => {
  const { currentUser } = useApp();
  return currentUser.role === 'Admin' ? <AdminDashboard /> : <UserDashboard />;
};

const UserDashboard = () => {
    const { setActiveView, currentUser } = useApp();
    return (
        <div className="flex-grow p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900">
            <div className="text-center max-w-2xl mx-auto">
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">Welcome, {currentUser.name.split(' ')[0]}!</h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">How can we help you today?</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <button onClick={() => setActiveView('new-incident')} className="group p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 text-left">
                        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">Report an Issue</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">Something is broken or not working as expected.</p>
                        <span className="font-semibold text-blue-600 flex items-center">Create Incident Report <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" /></span>
                    </button>
                    <button onClick={() => setActiveView('service-catalog')} className="group p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 text-left">
                        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">Request Something</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">Need new software, hardware, or access?</p>
                        <span className="font-semibold text-blue-600 flex items-center">Browse Service Catalog <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" /></span>
                    </button>
                </div>
            </div>
        </div>
    );
};

const AdminDashboard = () => {
    const { tickets, currentUser, calculateSLAStatus, setActiveView } = useApp();
    const myOpenTickets = tickets.filter(t => t.agentId === currentUser.id && (t.status === 'Open' || t.status === 'In Progress')).length;
    const totalOpenTickets = tickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
    const resolvedToday = tickets.filter(t => t.status === 'Resolved' && new Date(t.updatedAt).toDateString() === new Date().toDateString()).length;
    const slaAtRisk = tickets.filter(t => calculateSLAStatus(t) === 'At Risk').length;

    return (
        <div className="flex-grow p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                 <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome, {currentUser.name.split(' ')[0]}</h1>
                 <Button onClick={() => setActiveView('new-incident')} icon={PlusCircle}>New Ticket</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <Card><h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">My Open Tickets</h3><p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{myOpenTickets}</p></Card>
                <Card><h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Open Tickets</h3><p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{totalOpenTickets}</p></Card>
                <Card><h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Resolved Today</h3><p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{resolvedToday}</p></Card>
                <Card><h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">SLA At Risk</h3><p className={`mt-1 text-3xl font-semibold ${slaAtRisk > 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{slaAtRisk}</p></Card>
            </div>
        </div>
    );
};

const TicketList = () => {
    const { tickets, selectedTicketId, setSelectedTicketId, currentUser, searchQuery } = useApp();
    const [filter, setFilter] = useState('All');

    const filteredTickets = tickets.filter(t => {
        const searchMatch = searchQuery ? (t.subject.toLowerCase().includes(searchQuery.toLowerCase()) || t.id.toString().includes(searchQuery)) : true;
        const filterMatch = (filter === 'All') ||
                            (filter === 'Open' && (t.status === 'Open' || t.status === 'In Progress')) ||
                            (filter === 'My Tickets' && t.agentId === currentUser.id);
        return searchMatch && filterMatch;
    });

    const selectedTicket = tickets.find(t => t.id === selectedTicketId);

    return (
        <div className="flex-grow flex flex-col lg:flex-row bg-gray-50 dark:bg-gray-900 overflow-hidden">
            <div className={`w-full lg:w-1/3 xl:w-1/4 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col ${selectedTicketId ? 'hidden lg:flex' : 'flex'}`}>
                <div className="p-4 sm:p-6 lg:p-8 border-b border-gray-200 dark:border-gray-700">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tickets</h1>
                    <div className="mt-4 flex space-x-1 border border-gray-300 dark:border-gray-700 rounded-md p-1 w-fit bg-white dark:bg-gray-800">
                        {['All', 'Open', 'My Tickets'].map(f => (
                            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 text-sm rounded-md ${filter === f ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
                <ul className="divide-y divide-gray-200 dark:divide-gray-700 overflow-y-auto">
                    {filteredTickets.map(ticket => (
                        <li key={ticket.id} onClick={() => setSelectedTicketId(ticket.id)}
                            className={`p-4 cursor-pointer transition-colors ${selectedTicketId === ticket.id ? 'bg-blue-50 dark:bg-blue-900/50' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                            <div className="flex justify-between items-start">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white pr-2">{ticket.subject}</p>
                                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">#{ticket.id}</span>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">{USERS[ticket.requesterId].name}</span>
                                <StatusBadge status={ticket.status} />
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
            <div className={`w-full lg:flex-grow ${!selectedTicketId ? 'hidden lg:flex' : 'flex'} items-center justify-center`}>
                {selectedTicket ? <TicketDetail ticket={selectedTicket} /> : <div className="text-center text-gray-500"><FileText size={48} className="mx-auto mb-2" />Select a ticket to view details.</div>}
            </div>
        </div>
    );
};

const AIPoweredFeatures = ({ ticket }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [summary, setSummary] = useState('');
    const [steps, setSteps] = useState('');

    const callGeminiAPI = async (prompt) => {
        setIsLoading(true);
        setError(null);
        const API_KEY = ""; 
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;
        const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
        try {
            const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error("No content received from API.");
            return text;
        } catch (e) {
            console.error(e);
            setError(e.message);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const handleSummarize = async () => {
        setSteps('');
        const conversation = ticket.comments.map(c => `${USERS[c.authorId].name}: "${c.text}"`).join('\n');
        const prompt = `Summarize the following IT support ticket conversation into a few bullet points for a busy IT agent.\n\nTicket Subject: ${ticket.subject}\nInitial Description: ${ticket.description}\n\nConversation:\n${conversation}\n\nSummary:`;
        const result = await callGeminiAPI(prompt);
        if (result) setSummary(result);
    };

    const handleSuggestSteps = async () => {
        setSummary('');
        const prompt = `Provide a numbered list of potential troubleshooting steps for an IT administrator to solve the following incident.\n\nTicket Subject: ${ticket.subject}\nDescription: ${ticket.description}\n\nTroubleshooting Steps:`;
        const result = await callGeminiAPI(prompt);
        if (result) setSteps(result);
    };

    return (
        <Card className="bg-blue-50 dark:bg-gray-900/50 border border-blue-200 dark:border-blue-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Sparkles className="text-blue-500" />Agent Assist (Powered by Gemini)</h3>
            <div className="flex gap-4 mb-4">
                <Button onClick={handleSummarize} variant="secondary" disabled={isLoading} icon={BrainCircuit}>✨ Summarize</Button>
                {ticket.type === 'Incident' && <Button onClick={handleSuggestSteps} variant="secondary" disabled={isLoading} icon={BrainCircuit}>✨ Suggest Fix</Button>}
            </div>
            {isLoading && <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><Loader className="animate-spin" size={20} /><span>Generating...</span></div>}
            {error && <p className="text-red-500 text-sm">Error: {error}</p>}
            {(summary || steps) && (
                <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-md prose prose-sm dark:prose-invert max-w-none">
                    {summary && <pre className="whitespace-pre-wrap font-sans">{summary}</pre>}
                    {steps && <pre className="whitespace-pre-wrap font-sans">{steps}</pre>}
                </div>
            )}
        </Card>
    );
};

const TicketDetail = ({ ticket }) => {
    const { addComment, currentUser, assets, updateTicket, setSelectedTicketId } = useApp();
    const [comment, setComment] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    
    if (!ticket) return null;

    const handleCommentSubmit = (e) => {
        e.preventDefault();
        if (comment.trim()) {
            addComment(ticket.id, comment, isPrivate);
            setComment('');
        }
    };

    const handleStatusChange = (newStatus) => {
        updateTicket(ticket.id, { status: newStatus });
    };

    const getPrimaryAction = () => {
        switch(ticket.status) {
            case 'Open':
            case 'In Progress':
                return { label: 'Resolve Ticket', action: () => handleStatusChange('Resolved'), variant: 'primary' };
            case 'Resolved':
                return { label: 'Close Ticket', action: () => handleStatusChange('Closed'), variant: 'primary' };
            case 'Closed':
                return { label: 'Reopen Ticket', action: () => handleStatusChange('Open'), variant: 'secondary' };
            default:
                return null;
        }
    };

    const primaryAction = getPrimaryAction();
    
    const requester = USERS[ticket.requesterId];
    const ticketAssets = ticket.affectedAssets?.map(id => assets[id]).filter(Boolean) || [];

    return (
        <div className="flex-grow flex flex-col bg-white dark:bg-gray-800 overflow-y-auto">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setSelectedTicketId(null)} className="lg:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                        <ArrowLeft />
                    </button>
                    <div className="flex items-center gap-2">
                        {primaryAction && <Button onClick={primaryAction.action} variant={primaryAction.variant}>{primaryAction.label}</Button>}
                        <select value={ticket.status} onChange={(e) => handleStatusChange(e.target.value)} className="text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">
                            {STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{ticket.type} #{ticket.id}</p>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-1">{ticket.subject}</h2>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-2">
                    <StatusBadge status={ticket.status} />
                    <span>Requested by <strong>{requester.name}</strong></span>
                    <SLAIndicator ticket={ticket} />
                </div>
            </div>
            
            <div className="flex-grow p-4 sm:p-6 space-y-6 overflow-y-auto">
                {currentUser.role === 'Admin' && <AIPoweredFeatures ticket={ticket} />}
                <Card className="bg-gray-50 dark:bg-gray-900/50">
                    <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{ticket.description}</p>
                    {ticketAssets.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <h4 className="font-semibold text-sm">Affected Assets:</h4>
                            <ul className="text-sm text-gray-600 dark:text-gray-300">
                                {ticketAssets.map(asset => <li key={asset.id}>{asset.model} ({asset.id})</li>)}
                            </ul>
                        </div>
                    )}
                </Card>

                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Conversation</h3>
                    <div className="space-y-4">
                        {ticket.comments.map((c, index) => (
                            <div key={index} className={`flex gap-3 ${c.authorId === currentUser.id ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white ${c.authorId === currentUser.id ? 'bg-blue-600' : 'bg-gray-500'}`}>{USERS[c.authorId].avatar}</div>
                                <div className={`p-3 rounded-lg max-w-lg ${c.isPrivate ? 'bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-800' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{USERS[c.authorId].name}</span>
                                        {c.isPrivate && <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium ml-2">Private Note</span>}
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{c.text}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">{new Date(c.timestamp).toLocaleTimeString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <form onSubmit={handleCommentSubmit}>
                    <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment..." className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500" rows="3"></textarea>
                    <div className="flex justify-between items-center mt-2">
                        <label className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            Private note
                        </label>
                        <Button type="submit">Add Reply</Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ServiceCatalogView = () => {
    const { serviceCatalog, setActiveView } = useApp();
    return (
        <div className="flex-grow p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Service Catalog</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">Browse and request available IT services.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {serviceCatalog.map(item => {
                    const Icon = item.icon;
                    return (
                        <Card key={item.id} className="flex flex-col">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                                    <Icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{item.name}</h2>
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm flex-grow">{item.description}</p>
                            <div className="mt-6">
                                <Button onClick={() => setActiveView('new-request')} className="w-full">Request Service</Button>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

const NewTicketForm = ({ type }) => {
    const { createTicket, setActiveView, currentUser } = useApp();
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState(CATEGORIES[type][0]);
    const [priority, setPriority] = useState('Medium');
    const [affectedAssets, setAffectedAssets] = useState([]);

    const handleSubmit = (e) => {
        e.preventDefault();
        createTicket({ type, subject, description, category, priority, affectedAssets });
    };

    const userAssets = USERS[currentUser.id].assets || [];

    return (
        <div className="flex-grow p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                    {type === 'Incident' ? 'Report an Issue' : 'Create a Service Request'}
                </h1>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <Card>
                        <div>
                            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject</label>
                            <input type="text" id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div>
                            <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                            <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600">
                                {CATEGORIES[type].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                            <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} required rows="6" className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"></textarea>
                        </div>
                        {type === 'Incident' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Affected Assets</label>
                                    <div className="mt-2 space-y-2">
                                        {userAssets.map(assetId => (
                                            <label key={assetId} className="flex items-center">
                                                <input type="checkbox" value={assetId} onChange={(e) => {
                                                    if (e.target.checked) setAffectedAssets([...affectedAssets, assetId]);
                                                    else setAffectedAssets(affectedAssets.filter(id => id !== assetId));
                                                }} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                                <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">{ASSETS[assetId].model} ({assetId})</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Urgency</label>
                                    <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600">
                                        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            </>
                        )}
                    </Card>
                    <div className="flex justify-end gap-4">
                        <Button variant="secondary" onClick={() => setActiveView('dashboard')}>Cancel</Button>
                        <Button type="submit">Submit Ticket</Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const KnowledgeBaseView = () => {
    const { knowledgeBase, searchQuery } = useApp();
    const filteredArticles = knowledgeBase.filter(article =>
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex-grow p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Knowledge Base</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-8">Find answers to common questions and troubleshooting guides.</p>
            <div className="space-y-4">
                {filteredArticles.map(article => (
                    <Card key={article.id}>
                        <h2 className="text-xl font-semibold text-blue-600 dark:text-blue-400">{article.title}</h2>
                        <p className="mt-2 text-gray-600 dark:text-gray-300">{article.content}</p>
                    </Card>
                ))}
            </div>
        </div>
    );
};

const AssetsView = () => {
    const { assets } = useApp();
    return (
        <div className="flex-grow p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Asset Management</h1>
            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {Object.values(assets).map(asset => (
                                <tr key={asset.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{asset.id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{asset.model}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{USERS[asset.assignedTo].name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">{asset.status}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

const PlaceholderView = ({ title }) => (
    <div className="flex-grow p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">{title}</h1>
        <Card>
            <p className="text-gray-600 dark:text-gray-300">{title} page is under construction.</p>
        </Card>
    </div>
);

// ==================== Main App Component ====================
export default function App() {
  return (
    <AppProvider>
      <div className="h-screen w-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col font-sans">
        <NotificationContainer />
        <Header />
        <MainContent />
      </div>
    </AppProvider>
  );
}

const MainContent = () => {
    const { activeView, isMobileMenuOpen, setMobileMenuOpen } = useApp();

    const renderView = () => {
        switch (activeView) {
            case 'dashboard': return <Dashboard />;
            case 'tickets': return <TicketList />;
            case 'service-catalog': return <ServiceCatalogView />;
            case 'new-incident': return <NewTicketForm type="Incident" />;
            case 'new-request': return <NewTicketForm type="Service Request" />;
            case 'kb': return <KnowledgeBaseView />;
            case 'assets': return <AssetsView />;
            case 'reports': return <PlaceholderView title="Analytics" />;
            case 'automation': return <PlaceholderView title="Automation" />;
            case 'settings': return <PlaceholderView title="Settings" />;
            default: return <Dashboard />;
        }
    };

    return (
        <div className="flex flex-1 overflow-hidden">
            <div className="hidden lg:flex">
                <Sidebar />
            </div>
            {isMobileMenuOpen && (
                <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setMobileMenuOpen(false)}>
                    <div className="fixed inset-y-0 left-0 z-50" onClick={(e) => e.stopPropagation()}>
                        <Sidebar isMobile={true} />
                    </div>
                </div>
            )}
            <main className="flex-1 flex flex-col overflow-x-hidden">
                {renderView()}
            </main>
        </div>
    );
};
