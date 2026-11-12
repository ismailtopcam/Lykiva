package app.lykiva.kilitekrani

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/** JS'teki `KilitEkraniDurumu` (modules/kilit-ekrani/index.ts) */
class KilitEkraniDurumu : Record {
  @Field var kanalAdi: String = ""
  @Field var baslik: String = ""
  @Field var gecenMs: Double = 0.0
  @Field var sayiyor: Boolean = true
  @Field var mesafe: String = ""
  @Field var mesafeBirim: String = ""
  @Field var hiz: String = ""
  @Field var hizBirim: String = ""
  @Field var sureEtiket: String = ""
  @Field var mesafeEtiket: String = ""
  @Field var hizEtiket: String = ""
  @Field var gorev: String = ""
}

/**
 * Kilit ekranında süren kaydın penceresi.
 *
 * expo-location'ın ön plan servisi kendi bildirimini gösterir (kanal "<appId>:<görev adı>", kimlik servis
 * başına artan bir sayı). Onu sonradan değiştirmenin JS yolu yok; bu modül aynı kimlikle yeni bir bildirim
 * göndererek yerine geçer. Sistem kimliği ön plan servisine bağlı tuttuğu için servis bağı korunur ve
 * çekmecede tek bildirim kalır. Servis yoksa (duraklatıldı, arka plan izni yok) aynı pencere kendi
 * kimliğiyle ayrı bildirim olarak gösterilir.
 */
class KilitEkraniModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("KilitEkrani")

    Function("guncelle") { durum: KilitEkraniDurumu ->
      Pencere.guncelle(context, durum)
    }

    Function("kapat") {
      Pencere.kapat(context)
    }
  }
}

internal object Pencere {
  private const val KANAL = "lykiva_kayit_kilit"
  private const val KENDI_ID = 7351

  /** Pencerenin en son gösterildiği bildirim kimliği (servisinki ya da KENDI_ID) */
  private var sonId: Int? = null

  @Synchronized
  fun guncelle(context: Context, d: KilitEkraniDurumu) {
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    if (!nm.areNotificationsEnabled()) return
    kanalHazirla(context, nm, d.kanalAdi)
    val id = hedefKimlik(nm, d.gorev)
    val onceki = sonId
    // Servis değişti (duraklat → devam yeni servis açar) ya da servis kapandı: eski pencere kalmasın.
    // Hâlâ ön planda olan bir servisin bildirimini silme isteğini sistem yok sayar.
    if (onceki != null && onceki != id) nm.cancel(onceki)
    nm.notify(id, olustur(context, d))
    sonId = id
  }

  @Synchronized
  fun kapat(context: Context) {
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    nm.cancel(KENDI_ID)
    sonId?.let { if (it != KENDI_ID) nm.cancel(it) }
    sonId = null
  }

  /** Servisin bildirimi çekmecedeyse onun kimliği, yoksa pencerenin kendi kimliği */
  private fun hedefKimlik(nm: NotificationManager, gorev: String): Int {
    // Kanal kimliği Android 8'den önce yok; orada pencere ayrı bildirim olarak kalır
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || gorev.isEmpty()) return KENDI_ID
    val etkin = try {
      nm.activeNotifications
    } catch (e: RuntimeException) {
      return sonId ?: KENDI_ID
    }
    // Servis kendi metnine dönmüş olabilir (devamda yeniden başlatılınca): kanalından bulunur
    etkin.firstOrNull { it.id != KENDI_ID && it.notification.channelId?.endsWith(":$gorev") == true }
      ?.let { return it.id }
    // Daha önce yerine geçtiğimiz servis bildirimi (artık bizim kanalımızda) hâlâ duruyorsa
    val son = sonId
    if (son != null && son != KENDI_ID && etkin.any { it.id == son }) return son
    return KENDI_ID
  }

  private fun kanalHazirla(context: Context, nm: NotificationManager, kanalAdi: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val ad = kanalAdi.ifEmpty { context.applicationInfo.loadLabel(context.packageManager).toString() }
    val mevcut = nm.getNotificationChannel(KANAL)
    if (mevcut != null && mevcut.name == ad) return
    // Varsayılan önem ama sessiz: düşük önemli ("sessiz") bildirimler Android 10+ kilit ekranında görünmüyor.
    // Var olan kanalda sistem yalnızca adı günceller (dil değişince), kullanıcının ayarlarına dokunmaz.
    val kanal = NotificationChannel(KANAL, ad, NotificationManager.IMPORTANCE_DEFAULT).apply {
      setSound(null, null)
      enableVibration(false)
      enableLights(false)
      setShowBadge(false)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    }
    nm.createNotificationChannel(kanal)
  }

  private fun olustur(context: Context, d: KilitEkraniDurumu): Notification {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, KANAL)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context).setDefaults(0)
    }
    builder
      .setSmallIcon(kucukSimge(context))
      // Özel görünüm gösterilemezse ve ekran okuyucular için
      .setContentTitle(d.baslik)
      .setContentText("${d.mesafe} ${d.mesafeBirim} · ${d.hiz} ${d.hizBirim}")
      .setStyle(Notification.DecoratedCustomViewStyle())
      .setCustomContentView(gorunum(context, d, baslikli = false))
      .setCustomBigContentView(gorunum(context, d, baslikli = true))
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setCategory(Notification.CATEGORY_SERVICE)
    vurguRengi(context)?.let { builder.setColor(it) }
    acilisNiyeti(context)?.let { builder.setContentIntent(it) }
    return builder.build()
  }

  private fun gorunum(context: Context, d: KilitEkraniDurumu, baslikli: Boolean): RemoteViews {
    val v = RemoteViews(context.packageName, R.layout.kilit_ekrani_pencere)
    if (baslikli) {
      v.setTextViewText(R.id.kilit_baslik, d.baslik)
    } else {
      v.setViewVisibility(R.id.kilit_baslik, View.GONE)
    }
    // Süre telefonda sayar (ekran kapalıyken JS her saniye çalışmayabilir). Duraklatılınca durur ve
    // geçen süreyi gösterir: taban, şimdiden geçen süre kadar geride.
    val taban = SystemClock.elapsedRealtime() - d.gecenMs.toLong().coerceAtLeast(0L)
    v.setChronometer(R.id.kilit_sure, taban, null, d.sayiyor)
    v.setTextViewText(R.id.kilit_sure_etiket, d.sureEtiket)
    v.setTextViewText(R.id.kilit_mesafe, d.mesafe)
    v.setTextViewText(R.id.kilit_mesafe_birim, d.mesafeBirim)
    v.setTextViewText(R.id.kilit_mesafe_etiket, d.mesafeEtiket)
    v.setTextViewText(R.id.kilit_hiz, d.hiz)
    v.setTextViewText(R.id.kilit_hiz_birim, d.hizBirim)
    v.setTextViewText(R.id.kilit_hiz_etiket, d.hizEtiket)
    return v
  }

  /** expo-location'ın servis bildirimindeki simgenin aynısı */
  private fun kucukSimge(context: Context): Int {
    try {
      val ai = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
      val anahtar = "expo.modules.location.foreground_service_icon"
      if (ai.metaData?.containsKey(anahtar) == true) return ai.metaData.getInt(anahtar)
    } catch (e: Exception) {
      // varsayılana düş
    }
    return context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
      .takeIf { it != 0 } ?: context.applicationInfo.icon
  }

  /** expo-notifications eklentisinin rengi (app.json > expo-notifications > color) */
  private fun vurguRengi(context: Context): Int? {
    val id = context.resources.getIdentifier("notification_icon_color", "color", context.packageName)
    if (id == 0) return null
    return try {
      context.getColor(id)
    } catch (e: Exception) {
      null
    }
  }

  private fun acilisNiyeti(context: Context): PendingIntent? {
    val niyet = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    niyet.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
    return PendingIntent.getActivity(
      context,
      KENDI_ID,
      niyet,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }
}
