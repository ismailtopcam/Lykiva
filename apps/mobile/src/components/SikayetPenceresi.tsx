/**
 * Şikayet penceresi: neden seç (+ isteğe bağlı açıklama) → yönetime gider (supabase sikayet_et).
 * Kullanım: const sikayet = useSikayet(); ... sikayet.ac('activity', id, 'Bu aktivite'); ... {sikayet.pencere}
 */
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Txt } from '@/components/Txt';
import { Chip } from '@/components/ui';
import { sikayetEt, type SikayetTuru } from '@/lib/sikayet';
import { colors, fontFamily, space } from '@/theme';

const NEDENLER = ['Uygunsuz içerik', 'Taciz ya da zorbalık', 'Spam ya da reklam', 'Yanlış ya da tehlikeli bilgi', 'Başkası adına hesap', 'Diğer'];

type Hedef = { tur: SikayetTuru; id: string; ad: string };

export function useSikayet() {
  const [hedef, setHedef] = useState<Hedef | null>(null);
  return {
    ac: (tur: SikayetTuru, id: string, ad: string) => setHedef({ tur, id, ad }),
    pencere: hedef ? <SikayetPenceresi key={`${hedef.tur}:${hedef.id}`} hedef={hedef} kapat={() => setHedef(null)} /> : null,
  };
}

function SikayetPenceresi({ hedef, kapat }: { hedef: Hedef; kapat: () => void }) {
  const insets = useSafeAreaInsets();
  const [neden, setNeden] = useState<string | null>(null);
  const [aciklama, setAciklama] = useState('');
  const [durum, setDurum] = useState<'bos' | 'gonderiyor' | 'tamam'>('bos');
  const [hata, setHata] = useState<string | null>(null);

  const metin = [neden, aciklama.trim()].filter(Boolean).join(': ');
  const gonderilebilir = !!neden && (neden !== 'Diğer' || aciklama.trim().length >= 3) && durum === 'bos';

  async function gonder() {
    if (!gonderilebilir) return;
    setDurum('gonderiyor');
    setHata(null);
    try {
      await sikayetEt(hedef.tur, hedef.id, metin.slice(0, 500));
      setDurum('tamam');
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Gönderilemedi');
      setDurum('bos');
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={kapat}>
      <Pressable style={styles.perde} onPress={kapat} accessibilityLabel="Kapat" accessibilityRole="button" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.alt}>
        <View style={[styles.kart, { paddingBottom: insets.bottom + space.lg }]} accessibilityViewIsModal>
          <View style={styles.ust}>
            <Txt variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
              {durum === 'tamam' ? 'Teşekkürler' : 'Şikayet et'}
            </Txt>
            <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={kapat} hitSlop={10}>
              <Icon name="close" size={22} />
            </Pressable>
          </View>

          {durum === 'tamam' ? (
            <>
              <Txt style={{ marginTop: space.sm }}>Şikayetin yönetime iletildi. İnceleyip gerekirse içeriği kaldıracağız.</Txt>
              <Txt variant="small" style={{ marginTop: space.sm }}>
                Şikayet ettiğin kişi bunu görmez.
              </Txt>
              <Pressable accessibilityRole="button" onPress={kapat} style={[styles.dugme, { marginTop: space.lg }]}>
                <Txt style={styles.dugmeYazi}>Tamam</Txt>
              </Pressable>
            </>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: space.xs }}>
              <Txt variant="small" numberOfLines={2}>
                {hedef.ad}
              </Txt>
              <Txt style={{ fontFamily: fontFamily.bodySemiBold, marginTop: space.md, marginBottom: space.sm }}>Neden?</Txt>
              <View accessibilityRole="radiogroup" style={styles.nedenler}>
                {NEDENLER.map((n) => (
                  <Chip key={n} label={n} role="radio" selected={neden === n} onPress={() => setNeden(n)} />
                ))}
              </View>
              <TextInput
                value={aciklama}
                onChangeText={setAciklama}
                placeholder={neden === 'Diğer' ? 'Kısaca anlat (gerekli)' : 'Eklemek istediğin bir şey var mı? (isteğe bağlı)'}
                placeholderTextColor={colors.inkMuted}
                accessibilityLabel="Açıklama"
                multiline
                maxLength={400}
                style={styles.kutu}
              />
              {hata ? (
                <Txt accessibilityRole="alert" style={{ color: colors.terraInk, marginTop: space.sm }}>
                  {hata}
                </Txt>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !gonderilebilir, busy: durum === 'gonderiyor' }}
                disabled={!gonderilebilir}
                onPress={() => void gonder()}
                style={[styles.dugme, { marginTop: space.lg }, !gonderilebilir && { opacity: 0.45 }]}>
                {durum === 'gonderiyor' ? <ActivityIndicator color="#FFFFFF" /> : <Txt style={styles.dugmeYazi}>Gönder</Txt>}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  perde: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20, 26, 23, 0.45)' },
  alt: { flex: 1, justifyContent: 'flex-end' },
  kart: { backgroundColor: colors.ground, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: space.lg, paddingTop: space.lg, maxHeight: '85%' },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  nedenler: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kutu: {
    marginTop: space.md,
    minHeight: 80,
    maxHeight: 140,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    fontFamily: fontFamily.body,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  dugme: { height: 50, borderRadius: 25, backgroundColor: colors.terra, alignItems: 'center', justifyContent: 'center' },
  dugmeYazi: { color: '#FFFFFF', fontFamily: fontFamily.bodyBold, fontSize: 15 },
});

/** Sayfa altında küçük "… şikayet et" bağlantısı */
export function SikayetBaglantisi({ etiket, onPress }: { etiket: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={{ alignSelf: 'center', padding: 10, marginTop: space.lg }}>
      <Txt style={{ fontSize: 13, color: colors.inkMuted, textDecorationLine: 'underline' }}>{etiket}</Txt>
    </Pressable>
  );
}
