// Verifica el pago en Wompi y, solo si está APROBADO, entrega el PDF guardado en Supabase Storage (bucket privado).
const LINK_ID = process.env.WOMPI_LINK_ID !== undefined ? process.env.WOMPI_LINK_ID : "gA9CTe";
const SB_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const BUCKET = process.env.LIBRO_BUCKET || "libros";
const ARCHIVO = process.env.LIBRO_ARCHIVO || "100_Prompts_Publicitarios_IA_Edicion_Final.pdf";

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const id = String((req.query && req.query.id) || "").trim();
  if (!/^[A-Za-z0-9_\-]{5,80}$/.test(id)) return res.status(400).json({ ok: false, motivo: "id_invalido" });

  let tx;
  try {
    const r = await fetch("https://production.wompi.co/v1/transactions/" + encodeURIComponent(id));
    if (!r.ok) return res.status(404).json({ ok: false, motivo: "no_encontrada" });
    tx = (await r.json()).data;
  } catch (e) {
    return res.status(502).json({ ok: false, motivo: "wompi_no_responde" });
  }

  if (!tx || tx.status === "PENDING") return res.status(202).json({ ok: false, motivo: "pendiente" });
  if (tx.status !== "APPROVED") return res.status(402).json({ ok: false, motivo: "no_aprobada" });
  if (LINK_ID && tx.payment_link_id !== LINK_ID) return res.status(403).json({ ok: false, motivo: "otro_pago" });

  if (req.query.check) return res.status(200).json({ ok: true });

  try {
    const headers = { apikey: SB_KEY };
    if (SB_KEY.startsWith("eyJ")) headers.Authorization = "Bearer " + SB_KEY;
    const f = await fetch(SB_URL + "/storage/v1/object/" + BUCKET + "/" + encodeURIComponent(ARCHIVO), { headers });
    if (!f.ok) return res.status(500).json({ ok: false, motivo: "archivo_no_disponible" });
    const buf = Buffer.from(await f.arrayBuffer());
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="100-Prompts-Publicitarios-IA.pdf"');
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).json({ ok: false, motivo: "archivo_no_disponible" });
  }
};
