'use strict';

/* ===========================
   SHARED DATA
=========================== */
const facilities = [
  { name: 'Digital Oscilloscope',   qty: 20,  condition: 'Good',      lab: 'Physics Lab' },
  { name: 'Erlenmeyer Flask (500ml)',qty: 150, condition: 'Fair',      lab: 'Chemistry Lab' },
  { name: 'Human Skeleton Model',   qty: 5,   condition: 'Excellent', lab: 'Biology Lab' },
  { name: 'Desktop Computer (I7)',  qty: 30,  condition: 'Good',      lab: 'Computer Lab' },
  { name: 'Desktop Computer (I7)',  qty: 30,  condition: 'Good',      lab: 'Computer Lab' },
  { name: 'Microscope',             qty: 12,  condition: 'Excellent', lab: 'Biology Lab' },
  { name: 'Bunsen Burner',          qty: 40,  condition: 'Good',      lab: 'Chemistry Lab' },
  { name: 'Function Generator',     qty: 8,   condition: 'Fair',      lab: 'Physics Lab' },
  { name: 'Laptop (Core i5)',        qty: 25, condition: 'Good',      lab: 'Computer Lab' },
  { name: 'Centrifuge',             qty: 3,   condition: 'Poor',      lab: 'Biology Lab' },
];

const activities = [
  { type: 'add',    icon: '+',  time: '10:30 AM, Oct 26', html: '<strong>John Doe</strong> added 20 Dell Computers to Computer Lab' },
  { type: 'warn',   icon: '!',  time: '10:30 AM, Oct 26', html: '<strong>Mary Smith</strong> reported damage to Digital Oscilloscope' },
  { type: 'update', icon: '✓',  time: '10:30 AM, Oct 26', html: 'System updated inventory logs' },
  { type: 'update', icon: '✓',  time: '10:30 AM, Oct 26', html: 'System updated inventory logs' },
];

let damageReports = [
  {
    id: 'DR-1042',
    item: 'Desktop Computer #22',
    description: 'Cannot boot and shows repeated disk error during startup.',
    lab: 'Computer Lab',
    status: 'Open',
    priority: 'Critical',
    assignee: 'IT Support Team',
    reporter: 'Mary Smith',
    updatedAt: 'Apr 13, 09:20',
    createdAt: 'Apr 13, 08:50',
    overdue: true,
  },
  {
    id: 'DR-1041',
    item: 'Digital Oscilloscope',
    description: 'Channel B stops reading after 15 minutes of use.',
    lab: 'Physics Lab',
    status: 'In Progress',
    priority: 'High',
    assignee: 'Lab Technician',
    reporter: 'John Doe',
    updatedAt: 'Apr 13, 08:10',
    createdAt: 'Apr 12, 15:40',
    overdue: false,
  },
  {
    id: 'DR-1039',
    item: 'Centrifuge Unit #1',
    description: 'Motor vibrates heavily and stops before cycle completes.',
    lab: 'Biology Lab',
    status: 'Open',
    priority: 'High',
    assignee: 'Maintenance Vendor',
    reporter: 'Emily Carter',
    updatedAt: 'Apr 12, 16:45',
    createdAt: 'Apr 12, 14:10',
    overdue: true,
  },
  {
    id: 'DR-1038',
    item: 'Erlenmeyer Flask (500ml)',
    description: 'Reported chipped rim on one batch after practical class.',
    lab: 'Chemistry Lab',
    status: 'Resolved',
    priority: 'Medium',
    assignee: 'Safety Officer',
    reporter: 'Nadia Putri',
    updatedAt: 'Apr 12, 13:30',
    createdAt: 'Apr 11, 11:10',
    overdue: false,
  },
  {
    id: 'DR-1037',
    item: 'Microscope #07',
    description: 'Focus knob is loose and image cannot stay stable.',
    lab: 'Biology Lab',
    status: 'Open',
    priority: 'Medium',
    assignee: 'Lab Assistant',
    reporter: 'Rudi Hartono',
    updatedAt: 'Apr 11, 14:20',
    createdAt: 'Apr 11, 10:15',
    overdue: false,
  },
  {
    id: 'DR-1035',
    item: 'Function Generator',
    description: 'Output frequency drifts beyond tolerance during testing.',
    lab: 'Physics Lab',
    status: 'In Progress',
    priority: 'Medium',
    assignee: 'Calibration Team',
    reporter: 'Farah Aulia',
    updatedAt: 'Apr 10, 17:00',
    createdAt: 'Apr 10, 09:25',
    overdue: false,
  },
  {
    id: 'DR-1034',
    item: 'Bunsen Burner #05',
    description: 'Gas control valve is stiff and difficult to close fully.',
    lab: 'Chemistry Lab',
    status: 'Resolved',
    priority: 'Low',
    assignee: 'Lab Technician',
    reporter: 'Dian Sari',
    updatedAt: 'Apr 10, 12:10',
    createdAt: 'Apr 09, 16:20',
    overdue: false,
  },
  {
    id: 'DR-1032',
    item: 'Projector Unit #2',
    description: 'Image is blurry and overheats after extended presentation use.',
    lab: 'Computer Lab',
    status: 'Open',
    priority: 'High',
    assignee: 'AV Support',
    reporter: 'Kevin Tan',
    updatedAt: 'Apr 09, 15:10',
    createdAt: 'Apr 09, 09:45',
    overdue: true,
  },
];

/* ===========================
   UTILITY FUNCTIONS
=========================== */
function escHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}