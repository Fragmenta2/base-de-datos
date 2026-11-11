/** @type {import('next').NextConfig} */
const nextConfig = {
  // React Compiler: memoiza componentes y hooks automáticamente (menos re-renders al
  // escribir en buscadores, sumar al carrito, cambiar filtros...)
  reactCompiler: true,
  // Oculta el indicador flotante "N" de Next.js en modo desarrollo
  devIndicators: false,
};

export default nextConfig;
