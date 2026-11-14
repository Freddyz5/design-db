const ONE_DECIMAL = new Intl.NumberFormat("es", { maximumFractionDigits: 1 });

/**
 * The zoom as the scale of a drawing: 1 : 2 when the diagram shows at half
 * its size, 2 : 1 at double, 1 : 1 at its real size.
 */
export function drawingScale(zoom: number): string {
  if (!(zoom > 0)) return "";
  if (Math.abs(zoom - 1) < 0.005) return "1 : 1";
  return zoom < 1
    ? `1 : ${ONE_DECIMAL.format(1 / zoom)}`
    : `${ONE_DECIMAL.format(zoom)} : 1`;
}
