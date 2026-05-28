const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: { type: String },
  whatsappNumber: { type: String },
  amount: { type: Number, required: true }, // em Kz/BRL
  currency: { type: String, default: 'AOA' },
  method: { type: String, enum: ['multicaixa', 'pix', 'unitel_money', 'paypay', 'transferencia', 'outro'], default: 'multicaixa' },
  plan: { type: String, enum: ['1mes', '3meses', '6meses', '1ano', 'vitalicio'], default: '1mes' },
  receipt: { type: String, default: '' }, // URL do comprovante (Cloudinary)
  reference: { type: String, default: '' }, // referência do pagamento
  status: { type: String, enum: ['pendente', 'aprovado', 'rejeitado'], default: 'pendente' },
  notes: { type: String, default: '' },
  approvedAt: { type: Date, default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);
