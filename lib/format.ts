export const formatPrice = (lakh: number) => {
  if (lakh >= 100) {
    const cr = lakh / 100;
    const formatted = cr % 1 === 0 ? `${cr}` : `${Number(cr.toFixed(2))}`;
    return `₹${formatted} Cr`;
  }
  return `₹${lakh % 1 === 0 ? lakh : lakh.toFixed(lakh >= 20 ? 2 : 1)} L`;
};

export const MAX_RANGE_KM = 800;
