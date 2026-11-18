// A "Shop" link for the public pages (marketing page, login page). It shows itself only when the owner has switched the shop on, and
// stays invisible otherwise - so no page ever points to a closed shop.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { loadShopInfo } from '../../services/shop/shopService';

let cached: Promise<boolean> | null = null;
function shopIsOpen(): Promise<boolean> {
  if (!cached) cached = loadShopInfo().then((i) => !!i.enabled).catch(() => false);
  return cached;
}

export default function ShopNavLink({ className = '', children = 'Shop', withSeparator = false }: { className?: string; children?: string; withSeparator?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { let alive = true; void shopIsOpen().then((v) => { if (alive) setOpen(v); }); return () => { alive = false; }; }, []);
  if (!open) return null;
  return (
    <>
      {withSeparator && <span className="mx-2">·</span>}
      <Link to={ROUTES.SHOP} className={className}>{children}</Link>
    </>
  );
}
