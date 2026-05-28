export const initialFranjas = [
  { id: 'f1', hora: '13:00 - 13:15', reservados: 14, max: 20, estado: 'crítico' },
  { id: 'f2', hora: '13:15 - 13:30', reservados: 22, max: 25, estado: 'crítico' },
  { id: 'f3', hora: '13:30 - 13:45', reservados: 8,  max: 20, estado: 'libre' },
  { id: 'f4', hora: '13:45 - 14:00', reservados: 15, max: 20, estado: 'moderado' },
  { id: 'f5', hora: '14:00 - 14:15', reservados: 18, max: 20, estado: 'moderado' },
  { id: 'f6', hora: '14:15 - 14:30', reservados: 5,  max: 15, estado: 'libre' },
];

export const initialPedidos = [
  { id: '042', cliente: 'Joan M.', telefono: '600112233', hora: '13:15', detalle: '1 Pollo, 2 Patatas', origen: 'QR', entregado: false },
  { id: '043', cliente: 'Sra. Maria (Telf)', telefono: '934556677', hora: '13:20', detalle: '2 Pollos', origen: 'Manual', entregado: false },
  { id: '044', cliente: 'Carlos T.', telefono: '655443322', hora: '13:45', detalle: '1 Pollo, 1 Croquetas', origen: 'QR', entregado: false },
];
