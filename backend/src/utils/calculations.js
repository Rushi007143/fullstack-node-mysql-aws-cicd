function calculateGST(amount) {
  return Number(amount) * 0.18;
}

function calculateNetPayout(gross, commissionRate) {
  const commission = Number(gross) * Number(commissionRate);
  const gst = calculateGST(commission);
  return Number(gross) - commission - gst;
}

module.exports = { calculateGST, calculateNetPayout };
