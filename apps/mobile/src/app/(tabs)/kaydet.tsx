import { Redirect } from 'expo-router';

/**
 * Alt menüdeki Egzersiz sekmesi (yalnızca kayıt sürerken görünür) bu ekrana gitmez, süren kaydı açar.
 * Bu dosya yalnızca sekme yuvası için var; doğrudan açılırsa kayıt ekranına yönlendirir.
 */
export default function KaydetTab() {
  return <Redirect href="/kayit" />;
}
