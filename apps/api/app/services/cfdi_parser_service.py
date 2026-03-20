"""Parse CFDI 3.3 / 4.0 XML files and extract fiscal data."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from xml.etree import ElementTree as ET

logger = logging.getLogger(__name__)

# SAT CFDI namespaces
_NS = {
    "cfdi3": "http://www.sat.gob.mx/cfd/3",
    "cfdi4": "http://www.sat.gob.mx/cfd/4",
    "tfd":   "http://www.sat.gob.mx/TimbreFiscalDigital",
}


@dataclass
class CFDIData:
    uuid_fiscal: str
    rfc_emisor: str
    rfc_receptor: str
    nombre_emisor: str | None
    nombre_receptor: str | None
    fecha: date | None
    subtotal: float | None
    total: float | None
    iva: float | None
    currency: str
    metodo_pago: str | None
    forma_pago: str | None
    uso_cfdi: str | None
    conceptos: list[dict]
    version: str


def parse_cfdi_xml(xml_bytes: bytes) -> CFDIData:
    """Parse a CFDI XML file and return structured data.

    Supports CFDI 3.3 and 4.0 schemas.
    Raises ValueError if the XML is not a valid CFDI.
    """
    # Strip BOM and leading whitespace — common in real-world CFDI files
    xml_bytes = xml_bytes.lstrip(b"\xef\xbb\xbf \t\r\n")
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as exc:
        raise ValueError(f"XML inválido: {exc}") from exc

    # Detect version and namespace
    version = root.attrib.get("Version") or root.attrib.get("version", "")
    if version.startswith("4"):
        ns_prefix = "cfdi4"
    elif version.startswith("3"):
        ns_prefix = "cfdi3"
    else:
        # Try to detect from tag
        tag = root.tag
        if "cfd/4" in tag:
            ns_prefix = "cfdi4"
            version = "4.0"
        elif "cfd/3" in tag:
            ns_prefix = "cfdi3"
            version = "3.3"
        else:
            raise ValueError(f"Versión CFDI no soportada: {version or 'desconocida'}")

    ns = _NS[ns_prefix]

    # --- Comprobante (root) attributes ---
    fecha_str = root.attrib.get("Fecha", "")
    subtotal = _safe_float(root.attrib.get("SubTotal"))
    total = _safe_float(root.attrib.get("Total"))
    moneda = root.attrib.get("Moneda", "MXN")
    metodo_pago = root.attrib.get("MetodoPago")
    forma_pago = root.attrib.get("FormaPago")

    # --- Emisor ---
    emisor_el = root.find(f"{{{ns}}}Emisor")
    rfc_emisor = emisor_el.attrib.get("Rfc", "") if emisor_el is not None else ""
    nombre_emisor = emisor_el.attrib.get("Nombre") if emisor_el is not None else None

    # --- Receptor ---
    receptor_el = root.find(f"{{{ns}}}Receptor")
    rfc_receptor = receptor_el.attrib.get("Rfc", "") if receptor_el is not None else ""
    nombre_receptor = receptor_el.attrib.get("Nombre") if receptor_el is not None else None
    uso_cfdi = receptor_el.attrib.get("UsoCFDI") if receptor_el is not None else None

    # --- Conceptos ---
    conceptos = []
    conceptos_el = root.find(f"{{{ns}}}Conceptos")
    if conceptos_el is not None:
        for concepto in conceptos_el.findall(f"{{{ns}}}Concepto"):
            conceptos.append({
                "descripcion": concepto.attrib.get("Descripcion", ""),
                "cantidad": _safe_float(concepto.attrib.get("Cantidad")),
                "valor_unitario": _safe_float(concepto.attrib.get("ValorUnitario")),
                "importe": _safe_float(concepto.attrib.get("Importe")),
                "clave_prod_serv": concepto.attrib.get("ClaveProdServ", ""),
            })

    # --- IVA from Impuestos ---
    iva = _extract_iva(root, ns)

    # --- TimbreFiscalDigital (UUID) ---
    uuid_fiscal = ""
    complemento = root.find(f"{{{ns}}}Complemento")
    if complemento is not None:
        tfd = complemento.find(f"{{{_NS['tfd']}}}TimbreFiscalDigital")
        if tfd is not None:
            uuid_fiscal = tfd.attrib.get("UUID", "")

    if not uuid_fiscal:
        raise ValueError("CFDI sin UUID fiscal (TimbreFiscalDigital no encontrado).")
    if not rfc_emisor:
        raise ValueError("CFDI sin RFC del emisor.")

    # Parse date
    fecha: date | None = None
    if fecha_str:
        try:
            fecha = date.fromisoformat(fecha_str[:10])
        except ValueError:
            pass

    return CFDIData(
        uuid_fiscal=uuid_fiscal.upper(),
        rfc_emisor=rfc_emisor.upper(),
        rfc_receptor=rfc_receptor.upper(),
        nombre_emisor=nombre_emisor,
        nombre_receptor=nombre_receptor,
        fecha=fecha,
        subtotal=subtotal,
        total=total,
        iva=iva,
        currency=moneda,
        metodo_pago=metodo_pago,
        forma_pago=forma_pago,
        uso_cfdi=uso_cfdi,
        conceptos=conceptos,
        version=version,
    )


def _extract_iva(root: ET.Element, ns: str) -> float | None:
    """Extract total IVA (traslado 002) from Impuestos node."""
    impuestos = root.find(f"{{{ns}}}Impuestos")
    if impuestos is None:
        return None
    traslados = impuestos.find(f"{{{ns}}}Traslados")
    if traslados is None:
        return _safe_float(impuestos.attrib.get("TotalImpuestosTrasladados"))
    total_iva = 0.0
    found = False
    for t in traslados.findall(f"{{{ns}}}Traslado"):
        # Impuesto "002" = IVA
        if t.attrib.get("Impuesto") == "002":
            amt = _safe_float(t.attrib.get("Importe"))
            if amt is not None:
                total_iva += amt
                found = True
    return total_iva if found else _safe_float(impuestos.attrib.get("TotalImpuestosTrasladados"))


def extract_cfdi_from_pdf(pdf_bytes: bytes) -> CFDIData | None:
    """Try to extract a CFDI XML embedded inside a PDF.

    Many Mexican CFDI PDFs contain the XML as an embedded file or
    as raw XML text within the PDF stream. This function searches
    for the XML content and attempts to parse it.

    Returns CFDIData if found, None otherwise.
    """
    import re

    # Strategy 1: Look for XML between <?xml and </cfdi:Comprobante>
    # The XML is often embedded as-is or in a decoded stream
    patterns = [
        # Full XML document
        rb'(<\?xml[^>]*\?>.*?</cfdi:Comprobante>)',
        # Without XML declaration
        rb'(<cfdi:Comprobante[^>]*xmlns:cfdi[^>]*>.*?</cfdi:Comprobante>)',
    ]

    text = pdf_bytes
    # Also try to find XML in deflated streams — but first try raw bytes
    for pattern in patterns:
        matches = re.findall(pattern, text, re.DOTALL)
        for match in matches:
            try:
                return parse_cfdi_xml(match)
            except (ValueError, Exception):
                continue

    # Strategy 2: Try to decompress PDF streams and search within them
    try:
        import zlib
        # Find FlateDecode streams
        stream_pattern = rb'stream\r?\n(.*?)\r?\nendstream'
        for stream_match in re.finditer(stream_pattern, pdf_bytes, re.DOTALL):
            raw = stream_match.group(1)
            try:
                decompressed = zlib.decompress(raw)
                for pattern in patterns:
                    xml_matches = re.findall(pattern, decompressed, re.DOTALL)
                    for xml_match in xml_matches:
                        try:
                            return parse_cfdi_xml(xml_match)
                        except (ValueError, Exception):
                            continue
            except (zlib.error, Exception):
                continue
    except Exception:
        pass

    logger.debug("No embedded CFDI XML found in PDF")
    return None


def _safe_float(val: str | None) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None
