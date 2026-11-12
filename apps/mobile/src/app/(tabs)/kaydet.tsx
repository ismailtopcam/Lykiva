import { Redirect } from 'expo-router';

/**
 * Alt menüdeki Egzersiz sekmesi bu ekrana gitmez, kayıt ekranını açar.
 * Bu dosya yalnızca sekme yuvası için var; doğrudan açılırsa kayıt ekranına yönlendirir.
 */
export default function KaydetTab() {
  return <Redirect href="/kayit" />;
}
