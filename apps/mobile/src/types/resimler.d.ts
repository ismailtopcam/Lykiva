// Paketlenen görseller (Metro `import resim from './x.jpg'` ile kaynak kimliği verir)
declare module '*.jpg' {
  const kaynak: number;
  export default kaynak;
}
declare module '*.png' {
  const kaynak: number;
  export default kaynak;
}
