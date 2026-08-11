"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

const orders = [
  ["#G-1048", "Camila Rojas", "Kit Flores Silvestres", "$18.970", "Preparando", "pink"],
  ["#G-1047", "Francisca Díaz", "Molde personalizado", "$12.990", "Por revisar", "amber"],
  ["#G-1046", "Paula Silva", "Set Cumpleaños", "$24.490", "Enviado", "green"],
  ["#G-1045", "Daniela Soto", "Dino Rex · 2 unidades", "$7.980", "Entregado", "gray"],
];

const navigation = [["▦", "Resumen"], ["□", "Pedidos"], ["◇", "Productos"], ["♧", "Clientes"], ["◫", "Promociones"], ["⚙", "Configuración"]];

export default function AdminPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    window.setTimeout(() => { setLoading(false); setSignedIn(true); }, 600);
  }

  if (!signedIn) return (
    <main className="admin-login">
      <section className="login-card" aria-labelledby="login-title">
        <Image className="login-logo" src="/galletisima-logo.png" alt="Galletísima" width={420} height={128} priority />
        <div className="login-heading"><h1 id="login-title">Bienvenida de vuelta</h1><p>Ingresa a tu panel de administración</p></div>
        <form className="login-form" onSubmit={submit}>
          <label htmlFor="admin-email">Correo electrónico</label>
          <input id="admin-email" type="email" placeholder="hola@galletisima.cl" autoComplete="email" required />
          <div className="password-label"><label htmlFor="admin-password">Contraseña</label><a href="#recuperar">¿La olvidaste?</a></div>
          <div className="password-field"><input id="admin-password" type={showPassword ? "text" : "password"} placeholder="••••••••" minLength={6} required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Mostrar u ocultar contraseña">◎</button></div>
          <button className="login-submit" type="submit" disabled={loading}>{loading ? "Ingresando…" : "Ingresar al panel"}<span>→</span></button>
        </form>
        <p className="login-help">¿Necesitas ayuda? <a href="mailto:soporte@galletisima.cl">Contáctanos</a></p>
      </section>
      <p className="login-footer">© 2026 Galletísima · Hecho con cariño en Chile</p>
    </main>
  );

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Image src="/galletisima-logo.png" alt="Galletísima" width={190} height={58} priority />
        <nav aria-label="Navegación del panel">{navigation.map(([icon, label], index) => <button className={index === 0 ? "active" : ""} key={label}><span>{icon}</span>{label}</button>)}</nav>
        <div className="sidebar-user"><span>JM</span><div><strong>Josefina M.</strong><small>Administradora</small></div><button aria-label="Cerrar sesión" onClick={() => setSignedIn(false)}>↪</button></div>
      </aside>
      <section className="admin-content">
        <header className="admin-topbar"><div><p>Martes, 11 de agosto</p><h1>¡Hola, Josefina! <span>♡</span></h1></div><div className="top-actions"><button aria-label="Buscar">⌕</button><button aria-label="Notificaciones">♢</button><button className="new-product">＋ Nuevo producto</button></div></header>
        <div className="metric-grid">
          {[["↗","Ventas de hoy","$184.930","↑ 12,5% vs. ayer","pink"],["□","Pedidos nuevos","18","↑ 4 desde ayer","peach"],["♧","Clientes","1.284","↑ 8,2% este mes","lilac"],["◇","Productos activos","96","6 con stock bajo","mint"]].map(([icon,label,value,change,tone]) => <article key={label}><span className={`metric-icon ${tone}`}>{icon}</span><div><p>{label}</p><h2>{value}</h2><small>{change}</small></div></article>)}
        </div>
        <div className="dashboard-grid">
          <section className="panel sales-panel"><PanelTitle title="Ventas de la semana" copy="Ingresos de los últimos 7 días" action="Esta semana⌄" /><div className="chart">{[42,56,48,72,62,88,76].map((height,index)=><div className="bar-wrap" key={index}><span className="bar" style={{height:`${height}%`}}/><small>{["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"][index]}</small></div>)}</div></section>
          <section className="panel stock-panel"><PanelTitle title="Stock bajo" copy="Productos por reponer" action="Ver todos" />{[["Oso Tierno","3 unidades"],["Dino Rex","4 unidades"],["Flor Vintage","5 unidades"]].map(([name,stock], index)=><div className="stock-item" key={name}><span className={`stock-photo photo-${index}`}/><div><strong>{name}</strong><small>{stock}</small></div><button>Reponer</button></div>)}</section>
        </div>
        <section className="panel orders-panel"><PanelTitle title="Pedidos recientes" copy="Últimas compras de tu tienda" action="Ver todos los pedidos →" /><div className="orders-table"><div className="order-row order-head"><span>Pedido</span><span>Cliente</span><span>Producto</span><span>Total</span><span>Estado</span><span /></div>{orders.map(order=><div className="order-row" key={order[0]}><strong>{order[0]}</strong><span>{order[1]}</span><span>{order[2]}</span><strong>{order[3]}</strong><span><i className={`status ${order[5]}`}/>{order[4]}</span><button>•••</button></div>)}</div></section>
      </section>
    </main>
  );
}

function PanelTitle({title,copy,action}:{title:string;copy:string;action:string}) {
  return <div className="panel-title"><div><h2>{title}</h2><p>{copy}</p></div><button>{action}</button></div>;
}
