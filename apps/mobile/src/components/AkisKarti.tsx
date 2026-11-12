/**
 * Akıştaki tek aktivite kartı (gerçek veri). Tasarım: Akış ekranındaki gönderi kartı.
 */
import { ACTIVITY_LABELS, havaGecerliMi, havaOzeti, kmUnit, mUnit } from '@lykiva/shared';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { akisZamani, baslik, izi, kartIstatistikleri, turSimgesi, type AkisOgesi } from '@/akis/akis';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { TopoMap } from '@/components/map/TopoMap';
import { Txt } from '@/components/Txt';
import { Avatar, AvatarStack, Card, Stat } from '@/components/ui';
import { basHarfler, grupRengi } from '@/grup/gruplar';
import { colors, fontFamily, space, temaliStil } from '@/theme';
import { $t } from '@/i18n';

const GORUNURLUK = (): Record<AkisOgesi['visibility'], string> => ({
  public: $t('akisKarti.herkese_acik'),
  followers: $t('akisKarti.takipcilere'),
  groups: $t('akisKarti.gruplara'),
  private: $t('akisKarti.sadece_sen'),
});

/** "Cem'le", "Cem ve 2 kişiyle"; etiketlendiysen "seninle" */
function birlikteMetni(o: AkisOgesi) {
  const n = o.with_count ?? 0;
  if (!n || !o.with?.length) return '';
  if (o.tagged_me) return n === 1 ? 'seninle' : $t('akisKarti.sen_ve_kisiyle', { a: n - 1 });
  const ilk = o.with[0].ad.split(' ')[0];
  return n === 1 ? $t('akisKarti.ile', { ilk }) : $t('akisKarti.ve_kisiyle', { ilk, a: n - 1 });
}

type Props = {
  o: AkisOgesi;
  onBegen: (o: AkisOgesi) => void;
};

function AkisKartiIc({ o, onBegen }: Props) {
  const iz = izi(o.track);
  const s = kartIstatistikleri(o);
  const ad = baslik(o);
  const kisiye = () => (o.mine ? router.push('/profil') : router.push({ pathname: '/kisi/[id]', params: { id: o.owner_id } }));
  const aktiviteye = () => router.push({ pathname: '/aktivite/[id]', params: { id: o.id } });

  return (
    <Card style={styles.post}>
      <View style={styles.head}>
        <Pressable accessibilityRole="link" accessibilityLabel={$t('akisKarti.profili', { owner_name: o.owner_name })} onPress={kisiye} hitSlop={4}>
          <Avatar initials={basHarfler(o.owner_name)} tone={grupRengi(o.owner_id)} uri={o.owner_avatar} />
        </Pressable>
        <Pressable accessibilityRole="link" onPress={kisiye} style={{ flex: 1, minWidth: 0 }}>
          <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 14 }} numberOfLines={1}>
            {o.mine ? $t('ortak.sen') : o.owner_name}
            {birlikteMetni(o) ? <Txt style={{ color: colors.inkMuted }}> · {birlikteMetni(o)}</Txt> : null}
          </Txt>
          <Txt variant="small" numberOfLines={1}>
            {akisZamani(o.started_at)}
            {havaGecerliMi(o.weather) ? ` · ${havaOzeti(o.weather)}` : ''}
            {o.mine ? ` · ${GORUNURLUK()[o.visibility]}` : ''}
          </Txt>
        </Pressable>
        <View style={styles.typeBadge}>
          <Icon name={turSimgesi(o.activity)} size={15} color={colors.seaInk} strokeWidth={2} />
          <Txt style={{ fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: colors.seaInk }}>{ACTIVITY_LABELS[o.activity]}</Txt>
        </View>
      </View>

      <Pressable accessibilityRole="link" accessibilityLabel={$t('akisKarti.kilometre', { ad, km: s.km })} onPress={aktiviteye}>
        <Txt style={styles.title}>{ad}</Txt>
        <View style={styles.statRow}>
          <Stat label={$t('ortak.mesafe')} value={s.km} unit={kmUnit()} size={18} />
          <Stat label={$t('ortak.tirmanis')} value={s.tirmanis} unit={mUnit()} size={18} />
          <Stat label={$t('ortak.sure')} value={s.sure} size={18} />
          <Stat label={$t('ortak.ort_hiz')} value={s.hiz} unit={$t('akisKarti.km_sa')} size={18} />
        </View>
        {iz.length > 1 ? (
          <TopoMap
            route={iz}
            interactive={false}
            markers={[
              { id: 's', coord: iz[0], kind: 'start' },
              { id: 'e', coord: iz[iz.length - 1], kind: 'end' },
            ]}
            padding={{ top: 24, bottom: 24 }}
            style={{ height: 176 }}
            accessibilityLabel={$t('akisKarti.rotasinin_haritasi', { ad })}
          />
        ) : null}
      </Pressable>

      {o.with?.length || o.stop_count ? (
        <View style={styles.meta}>
          {o.with?.length ? <AvatarStack items={o.with.map((k) => ({ initials: basHarfler(k.ad), tone: grupRengi(k.id) }))} size={26} /> : null}
          <Txt variant="small">{[o.with?.length ? $t('akisKarti.birlikte_yaptilar') : null, o.stop_count ? $t('akisKarti.mola', { stop_count: o.stop_count }) : null].filter(Boolean).join(' · ')}</Txt>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: o.liked }}
          accessibilityLabel={$t('akisKarti.begeni', { a: o.liked ? $t('ortak.begeniyi_geri_al') : $t('ortak.begen'), like_count: o.like_count })}
          onPress={() => onBegen(o)}
          style={styles.action}>
          <Icon name="heart" size={21} color={o.liked ? colors.terra : colors.ink} />
          <Txt style={[styles.actionText, o.liked && { color: colors.terra }]}>{o.like_count}</Txt>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={$t('akisKarti.yorum', { comment_count: o.comment_count })}
          onPress={() => router.push({ pathname: '/aktivite/[id]/yorumlar', params: { id: o.id } })}
          style={styles.action}>
          <Icon name="chat" size={21} />
          <Txt style={styles.actionText}>{o.comment_count}</Txt>
        </Pressable>
        <View style={{ flex: 1 }} />
        {o.mine ? (
          <IconButton icon="share" label={$t('ortak.paylas')} onPress={() => router.push({ pathname: '/aktivite/[id]/paylas', params: { id: o.id } })} />
        ) : null}
      </View>
    </Card>
  );
}

export const AkisKarti = memo(AkisKartiIc);

const styles = temaliStil(() => StyleSheet.create({
  post: { marginHorizontal: space.md, marginBottom: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingBottom: 10 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: colors.seaSoft },
  title: { fontFamily: fontFamily.display, fontSize: 21, paddingHorizontal: 14, paddingBottom: 10, color: colors.ink },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 10 },
  actionText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, color: colors.ink },
}));
