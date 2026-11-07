import { sectionBySlug } from './sections';
import styles from './admin.module.css';

/** 1. aşama: bölüm başlığı ve planı. Veri, Supabase bağlanınca gelecek. */
export function AdminPlaceholder({ slug }: { slug: string }) {
  const section = sectionBySlug(slug);
  return (
    <>
      <h1 className={styles.pageTitle}>{section.label}</h1>
      <div className={styles.notice}>Henüz veri bağlı değil. Bu bölüm sonraki aşamalarda doldurulacak.</div>
      <section className={styles.card} aria-labelledby={`${slug}-plan`}>
        <h2 id={`${slug}-plan`} className={styles.cardTitle}>
          Bu sayfada olacaklar
        </h2>
        <ul className={styles.planList}>
          {section.plan.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
