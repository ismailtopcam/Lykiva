package app.lykiva.kilitekrani

import android.annotation.TargetApi
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Build
import android.os.SystemClock
import android.service.notification.StatusBarNotification
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.RelativeSizeSpan
import android.widget.RemoteViews
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class KilitEkraniDurumu : Record {
  @Field var kanalAdi: String = ""
  @Field var baslik: String = ""
  @Field var gecenMs: Double = 0.0
  @Field var sayiyor: Boolean = true
  @Field var mesafe: String = ""
  @Field var mesafeBirim: String = ""
  @Field var anlik: String = ""
  @Field var hiz: String = ""
  @Field var hizBirim: String = ""
  @Field var sureEtiket: String = ""
  @Field var mesafeEtiket: String = ""
  @Field var anlikEtiket: String = ""
  @Field var hizEtiket: String = ""
  @Field var gorev: String = ""
}

/**
 * Kilit ekranında süren kaydın penceresi.
 *
 * Kayıt sürerken expo-location'ın ön plan servisi bir bildirim gösterir. Aynı kimlikle yeni bildirim
 * göndermek o bildirimi günceller (servis bağı korunur), böylece tek bir bildirim kalır. Servis yoksa
 * (duraklatıldı ya da arka plan izni yok) pencere kendi kimliğimizle ayrı bir bildirim olarak gösterilir.
 *
 * Kanal "varsayılan" önemde ama sessiz: Android 10+ "sessiz" (düşük önemli) bildirimleri kilit ekranında
 * göstermediği için servisin kendi kanalı (düşük önem) yetmez.
 */
class KilitEkraniModule : Module() {
  private val context: Context?
    get() = appContext.reactContext

  override fun definition() = ModuleDefinition {
    Name("KilitEkrani")

    Function("guncelle") { durum: KilitEkraniDurumu ->
      guncelle(durum)
    }

    Function("kapat") {
      kapat()
    }
  }

  private fun guncelle(d: KilitEkraniDurumu) {
    // Bildirim kanalları Android 8'de geldi; daha eskisinde pencere gösterilmez
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val ctx = context ?: return
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    kanaliHazirla(nm, d.kanalAdi)

    // Duraklatılınca servis kapanıyor; o sırada servis bildirimini güncellemek pencereyi kaybettirebilir
    val servis = if (d.sayiyor) servisBildirimi(nm, d.gorev) else null
    val bildirim = olustur(ctx, d, servis?.notification?.smallIcon)
    if (servis != null) {
      nm.notify(servis.tag, servis.id, bildirim)
      nm.cancel(KENDI_KIMLIK)
    } else {
      nm.notify(KENDI_KIMLIK, bildirim)
    }
  }

  private fun kapat() {
    val nm = context?.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    nm.cancel(KENDI_KIMLIK)
  }

  /** expo-location'ın ön plan servisi bildirimi: kanalı "<uygulama>:<görev>" ya da (güncellendiyse) bizimki */
  @TargetApi(Build.VERSION_CODES.O)
  private fun servisBildirimi(nm: NotificationManager, gorev: String): StatusBarNotification? {
    val bildirimler = try {
      nm.activeNotifications
    } catch (e: Exception) {
      return null
    }
    return bildirimler.firstOrNull { sbn ->
      val n = sbn.notification
      sbn.id != KENDI_KIMLIK &&
        (n.flags and Notification.FLAG_FOREGROUND_SERVICE) != 0 &&
        (n.channelId == KANAL || (gorev.isNotEmpty() && n.channelId?.endsWith(":$gorev") == true))
    }
  }

  @TargetApi(Build.VERSION_CODES.O)
  private fun kanaliHazirla(nm: NotificationManager, ad: String) {
    val mevcut = nm.getNotificationChannel(KANAL)
    if (mevcut != null) {
      // Dil değiştiyse kanal adı da değişsin (önem ve ses kullanıcının ayarında kalır)
      if (ad.isNotEmpty() && mevcut.name != ad) {
        mevcut.name = ad
        nm.createNotificationChannel(mevcut)
      }
      return
    }
    val kanal = NotificationChannel(KANAL, ad.ifEmpty { "Lykiva" }, NotificationManager.IMPORTANCE_DEFAULT).apply {
      setSound(null, null)
      enableVibration(false)
      enableLights(false)
      setShowBadge(false)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    }
    nm.createNotificationChannel(kanal)
  }

  @TargetApi(Build.VERSION_CODES.O)
  private fun olustur(ctx: Context, d: KilitEkraniDurumu, servisSimgesi: Icon?): Notification {
    val kucuk = pencere(ctx, R.layout.kilit_ekrani_kucuk, d, ortalamaVar = false)
    val buyuk = pencere(ctx, R.layout.kilit_ekrani_buyuk, d, ortalamaVar = true)
    val ozet = "${d.mesafe} ${d.mesafeBirim} · ${d.anlik} ${d.hizBirim}"

    val b = Notification.Builder(ctx, KANAL)
      .setContentTitle(d.baslik)
      .setContentText(ozet)
      .setSubText(d.baslik)
      .setStyle(Notification.DecoratedCustomViewStyle())
      .setCustomContentView(kucuk)
      .setCustomBigContentView(buyuk)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setColor(RENK)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
    }
    if (servisSimgesi != null) b.setSmallIcon(servisSimgesi) else b.setSmallIcon(simge(ctx))
    acmaNiyeti(ctx)?.let { b.setContentIntent(it) }
    return b.build()
  }

  /** Kapalı pencere: süre, mesafe, anlık hız. Açık pencere (2×2): ortalama hız da. */
  private fun pencere(ctx: Context, duzen: Int, d: KilitEkraniDurumu, ortalamaVar: Boolean): RemoteViews {
    val v = RemoteViews(ctx.packageName, duzen)
    // Chronometer SystemClock.elapsedRealtime() ile sayar: taban = şimdi - geçen süre
    val taban = SystemClock.elapsedRealtime() - d.gecenMs.toLong()
    v.setChronometer(R.id.kilit_sure, taban, null, d.sayiyor)
    v.setTextViewText(R.id.kilit_mesafe, birimli(d.mesafe, d.mesafeBirim))
    v.setTextViewText(R.id.kilit_anlik, birimli(d.anlik, d.hizBirim))
    v.setTextViewText(R.id.kilit_sure_etiket, d.sureEtiket)
    v.setTextViewText(R.id.kilit_mesafe_etiket, d.mesafeEtiket)
    v.setTextViewText(R.id.kilit_anlik_etiket, d.anlikEtiket)
    if (ortalamaVar) {
      v.setTextViewText(R.id.kilit_hiz, birimli(d.hiz, d.hizBirim))
      v.setTextViewText(R.id.kilit_hiz_etiket, d.hizEtiket)
    }
    return v
  }

  /** "12,4 km": birim daha küçük */
  private fun birimli(deger: String, birim: String): CharSequence {
    if (birim.isEmpty()) return deger
    val s = SpannableStringBuilder(deger).append(' ')
    val bas = s.length
    s.append(birim)
    s.setSpan(RelativeSizeSpan(0.6f), bas, s.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    return s
  }

  private fun simge(ctx: Context): Int {
    val ozel = ctx.resources.getIdentifier("notification_icon", "drawable", ctx.packageName)
    return if (ozel != 0) ozel else ctx.applicationInfo.icon
  }

  private fun acmaNiyeti(ctx: Context): PendingIntent? {
    val niyet = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: return null
    niyet.flags = niyet.flags or Intent.FLAG_ACTIVITY_SINGLE_TOP
    return PendingIntent.getActivity(ctx, 0, niyet, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  companion object {
    private const val KANAL = "lykiva-kayit"
    private const val KENDI_KIMLIK = 73_001
    private const val RENK = 0xFFB04E25.toInt()
  }
}
