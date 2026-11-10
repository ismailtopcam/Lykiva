'use client';

import { useFormStatus } from 'react-dom';

import styles from './admin.module.css';

/** Form gönderen düğme; geri alınamaz işlemlerde önce onay ister */
export function OnayliDugme({ etiket, onay, tehlikeli }: { etiket: string; onay?: string; tehlikeli?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={tehlikeli ? `${styles.btn} ${styles.btnTehlike}` : styles.btn}
      onClick={(e) => {
        if (onay && !window.confirm(onay)) e.preventDefault();
      }}>
      {pending ? '…' : etiket}
    </button>
  );
}
