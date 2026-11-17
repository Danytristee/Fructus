
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "abonos": {
                  Row: {
                    "cliente_id": number,"comando_voz_id": number | null,"fecha": string,"id": number,"medio_pago": Database["public"]['Enums']["medio_pago"],"monto": number,"nota": string | null,"registrado_por": string,"venta_id": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cliente_id": number,"comando_voz_id"?: number | null,"fecha"?: string,"id"?: never,"medio_pago": Database["public"]['Enums']["medio_pago"],"monto": number,"nota"?: string | null,"registrado_por"?: string,"venta_id"?: number | null
                  }
                  Update: {
                    "cliente_id"?: number,"comando_voz_id"?: number | null,"fecha"?: string,"id"?: never,"medio_pago"?: Database["public"]['Enums']["medio_pago"],"monto"?: number,"nota"?: string | null,"registrado_por"?: string,"venta_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "abonos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "abonos_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "v_saldo_clientes"
      referencedColumns: ["cliente_id"]
    },{
      foreignKeyName: "abonos_comando_voz_id_fkey"
      columns: ["comando_voz_id"]
isOneToOne: false
      referencedRelation: "comandos_voz"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "abonos_registrado_por_fkey"
      columns: ["registrado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "abonos_venta_id_fkey"
      columns: ["venta_id"]
isOneToOne: false
      referencedRelation: "ventas"
      referencedColumns: ["id"]
    }
                  ]
                },"clientes": {
                  Row: {
                    "activo": boolean,"alias": (string)[],"creado_en": string,"direccion": string | null,"id": number,"limite_credito": number | null,"nombre": string,"notas": string | null,"numero_documento": string | null,"telefono": string | null,"tipo_documento": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"alias"?: (string)[],"creado_en"?: string,"direccion"?: string | null,"id"?: never,"limite_credito"?: number | null,"nombre": string,"notas"?: string | null,"numero_documento"?: string | null,"telefono"?: string | null,"tipo_documento"?: string | null
                  }
                  Update: {
                    "activo"?: boolean,"alias"?: (string)[],"creado_en"?: string,"direccion"?: string | null,"id"?: never,"limite_credito"?: number | null,"nombre"?: string,"notas"?: string | null,"numero_documento"?: string | null,"telefono"?: string | null,"tipo_documento"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"comandos_voz": {
                  Row: {
                    "confirmado_por": string | null,"creado_en": string,"duracion_audio_ms": number | null,"id": number,"intencion": string | null,"interpretacion": Json | null,"latencia_ms": number | null,"modelo_llm": string | null,"modelo_stt": string | null,"registrado_por": string,"resultado": string,"transcripcion": string
                  }
                  ComputedFields: never
                  Insert: {
                    "confirmado_por"?: string | null,"creado_en"?: string,"duracion_audio_ms"?: number | null,"id"?: never,"intencion"?: string | null,"interpretacion"?: Json | null,"latencia_ms"?: number | null,"modelo_llm"?: string | null,"modelo_stt"?: string | null,"registrado_por"?: string,"resultado"?: string,"transcripcion": string
                  }
                  Update: {
                    "confirmado_por"?: string | null,"creado_en"?: string,"duracion_audio_ms"?: number | null,"id"?: never,"intencion"?: string | null,"interpretacion"?: Json | null,"latencia_ms"?: number | null,"modelo_llm"?: string | null,"modelo_stt"?: string | null,"registrado_por"?: string,"resultado"?: string,"transcripcion"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comandos_voz_registrado_por_fkey"
      columns: ["registrado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"compra_items": {
                  Row: {
                    "cantidad": number,"compra_id": number,"costo_unitario": number,"id": number,"producto_id": number,"subtotal": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cantidad": number,"compra_id": number,"costo_unitario": number,"id"?: never,"producto_id": number,"subtotal"?: never
                  }
                  Update: {
                    "cantidad"?: number,"compra_id"?: number,"costo_unitario"?: number,"id"?: never,"producto_id"?: number,"subtotal"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "compra_items_compra_id_fkey"
      columns: ["compra_id"]
isOneToOne: false
      referencedRelation: "compras"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "compra_items_producto_id_fkey"
      columns: ["producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "compra_items_producto_id_fkey"
      columns: ["producto_id"]
isOneToOne: false
      referencedRelation: "v_stock"
      referencedColumns: ["producto_id"]
    }
                  ]
                },"compras": {
                  Row: {
                    "comando_voz_id": number | null,"condicion": Database["public"]['Enums']["condicion_pago"],"creado_en": string,"fecha": string,"id": number,"medio_pago": Database["public"]['Enums']["medio_pago"] | null,"numero_comprobante": string | null,"proveedor_id": number | null,"registrado_por": string,"total": number
                  }
                  ComputedFields: never
                  Insert: {
                    "comando_voz_id"?: number | null,"condicion"?: Database["public"]['Enums']["condicion_pago"],"creado_en"?: string,"fecha"?: string,"id"?: never,"medio_pago"?: Database["public"]['Enums']["medio_pago"] | null,"numero_comprobante"?: string | null,"proveedor_id"?: number | null,"registrado_por"?: string,"total"?: number
                  }
                  Update: {
                    "comando_voz_id"?: number | null,"condicion"?: Database["public"]['Enums']["condicion_pago"],"creado_en"?: string,"fecha"?: string,"id"?: never,"medio_pago"?: Database["public"]['Enums']["medio_pago"] | null,"numero_comprobante"?: string | null,"proveedor_id"?: number | null,"registrado_por"?: string,"total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "compras_comando_voz_id_fkey"
      columns: ["comando_voz_id"]
isOneToOne: false
      referencedRelation: "comandos_voz"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "compras_proveedor_id_fkey"
      columns: ["proveedor_id"]
isOneToOne: false
      referencedRelation: "proveedores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "compras_proveedor_id_fkey"
      columns: ["proveedor_id"]
isOneToOne: false
      referencedRelation: "v_saldo_proveedores"
      referencedColumns: ["proveedor_id"]
    },{
      foreignKeyName: "compras_registrado_por_fkey"
      columns: ["registrado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"comprobantes": {
                  Row: {
                    "actualizado_en": string,"ambiente": string,"creado_en": string,"estado": Database["public"]['Enums']["estado_comprobante"],"id": number,"numero": number,"pdf_url": string | null,"respuesta": Json | null,"serie": string,"tipo": string,"venta_id": number,"xml_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"ambiente"?: string,"creado_en"?: string,"estado"?: Database["public"]['Enums']["estado_comprobante"],"id"?: never,"numero": number,"pdf_url"?: string | null,"respuesta"?: Json | null,"serie": string,"tipo": string,"venta_id": number,"xml_url"?: string | null
                  }
                  Update: {
                    "actualizado_en"?: string,"ambiente"?: string,"creado_en"?: string,"estado"?: Database["public"]['Enums']["estado_comprobante"],"id"?: never,"numero"?: number,"pdf_url"?: string | null,"respuesta"?: Json | null,"serie"?: string,"tipo"?: string,"venta_id"?: number,"xml_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "comprobantes_serie_fkey"
      columns: ["serie"]
isOneToOne: false
      referencedRelation: "series_comprobante"
      referencedColumns: ["serie"]
    },{
      foreignKeyName: "comprobantes_venta_id_fkey"
      columns: ["venta_id"]
isOneToOne: false
      referencedRelation: "ventas"
      referencedColumns: ["id"]
    }
                  ]
                },"frases_tomadas": {
                  Row: {
                    "celular": string,"frase": string,"id": number,"tomada_en": string,"tomada_por": string
                  }
                  ComputedFields: never
                  Insert: {
                    "celular": string,"frase": string,"id"?: never,"tomada_en"?: string,"tomada_por"?: string
                  }
                  Update: {
                    "celular"?: string,"frase"?: string,"id"?: never,"tomada_en"?: string,"tomada_por"?: string
                  }
                  Relationships: [
                    
                  ]
                },"gastos": {
                  Row: {
                    "categoria": string,"comando_voz_id": number | null,"descripcion": string | null,"fecha": string,"id": number,"medio_pago": Database["public"]['Enums']["medio_pago"],"monto": number,"registrado_por": string
                  }
                  ComputedFields: never
                  Insert: {
                    "categoria": string,"comando_voz_id"?: number | null,"descripcion"?: string | null,"fecha"?: string,"id"?: never,"medio_pago"?: Database["public"]['Enums']["medio_pago"],"monto": number,"registrado_por"?: string
                  }
                  Update: {
                    "categoria"?: string,"comando_voz_id"?: number | null,"descripcion"?: string | null,"fecha"?: string,"id"?: never,"medio_pago"?: Database["public"]['Enums']["medio_pago"],"monto"?: number,"registrado_por"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gastos_comando_voz_id_fkey"
      columns: ["comando_voz_id"]
isOneToOne: false
      referencedRelation: "comandos_voz"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gastos_registrado_por_fkey"
      columns: ["registrado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"movimientos_stock": {
                  Row: {
                    "cantidad": number,"comando_voz_id": number | null,"compra_id": number | null,"estado_llegada": Database["public"]['Enums']["estado_llegada"] | null,"fecha": string,"id": number,"motivo": string | null,"producto_id": number,"registrado_por": string,"tipo": Database["public"]['Enums']["tipo_movimiento"],"venta_id": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cantidad": number,"comando_voz_id"?: number | null,"compra_id"?: number | null,"estado_llegada"?: Database["public"]['Enums']["estado_llegada"] | null,"fecha"?: string,"id"?: never,"motivo"?: string | null,"producto_id": number,"registrado_por"?: string,"tipo": Database["public"]['Enums']["tipo_movimiento"],"venta_id"?: number | null
                  }
                  Update: {
                    "cantidad"?: number,"comando_voz_id"?: number | null,"compra_id"?: number | null,"estado_llegada"?: Database["public"]['Enums']["estado_llegada"] | null,"fecha"?: string,"id"?: never,"motivo"?: string | null,"producto_id"?: number,"registrado_por"?: string,"tipo"?: Database["public"]['Enums']["tipo_movimiento"],"venta_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "movimientos_stock_comando_voz_id_fkey"
      columns: ["comando_voz_id"]
isOneToOne: false
      referencedRelation: "comandos_voz"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimientos_stock_compra_id_fkey"
      columns: ["compra_id"]
isOneToOne: false
      referencedRelation: "compras"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimientos_stock_producto_id_fkey"
      columns: ["producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimientos_stock_producto_id_fkey"
      columns: ["producto_id"]
isOneToOne: false
      referencedRelation: "v_stock"
      referencedColumns: ["producto_id"]
    },{
      foreignKeyName: "movimientos_stock_registrado_por_fkey"
      columns: ["registrado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimientos_stock_venta_id_fkey"
      columns: ["venta_id"]
isOneToOne: false
      referencedRelation: "ventas"
      referencedColumns: ["id"]
    }
                  ]
                },"pagos_proveedor": {
                  Row: {
                    "comando_voz_id": number | null,"fecha": string,"id": number,"medio_pago": Database["public"]['Enums']["medio_pago"],"monto": number,"nota": string | null,"proveedor_id": number,"registrado_por": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comando_voz_id"?: number | null,"fecha"?: string,"id"?: never,"medio_pago": Database["public"]['Enums']["medio_pago"],"monto": number,"nota"?: string | null,"proveedor_id": number,"registrado_por"?: string
                  }
                  Update: {
                    "comando_voz_id"?: number | null,"fecha"?: string,"id"?: never,"medio_pago"?: Database["public"]['Enums']["medio_pago"],"monto"?: number,"nota"?: string | null,"proveedor_id"?: number,"registrado_por"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pagos_proveedor_comando_voz_id_fkey"
      columns: ["comando_voz_id"]
isOneToOne: false
      referencedRelation: "comandos_voz"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagos_proveedor_proveedor_id_fkey"
      columns: ["proveedor_id"]
isOneToOne: false
      referencedRelation: "proveedores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagos_proveedor_proveedor_id_fkey"
      columns: ["proveedor_id"]
isOneToOne: false
      referencedRelation: "v_saldo_proveedores"
      referencedColumns: ["proveedor_id"]
    },{
      foreignKeyName: "pagos_proveedor_registrado_por_fkey"
      columns: ["registrado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"perfiles": {
                  Row: {
                    "activo": boolean,"creado_en": string,"id": string,"nombre": string,"rol": Database["public"]['Enums']["rol_usuario"]
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"creado_en"?: string,"id": string,"nombre": string,"rol"?: Database["public"]['Enums']["rol_usuario"]
                  }
                  Update: {
                    "activo"?: boolean,"creado_en"?: string,"id"?: string,"nombre"?: string,"rol"?: Database["public"]['Enums']["rol_usuario"]
                  }
                  Relationships: [
                    
                  ]
                },"productos": {
                  Row: {
                    "activo": boolean,"afectacion_igv": string,"alias": (string)[],"calibre": string | null,"costo_referencia": number | null,"creado_en": string,"id": number,"kg_por_caja": number | null,"marca": string | null,"nombre": string,"precio_referencia": number | null,"seleccion": string | null,"unidad": string,"variedad": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"afectacion_igv"?: string,"alias"?: (string)[],"calibre"?: string | null,"costo_referencia"?: number | null,"creado_en"?: string,"id"?: never,"kg_por_caja"?: number | null,"marca"?: string | null,"nombre": string,"precio_referencia"?: number | null,"seleccion"?: string | null,"unidad"?: string,"variedad"?: string | null
                  }
                  Update: {
                    "activo"?: boolean,"afectacion_igv"?: string,"alias"?: (string)[],"calibre"?: string | null,"costo_referencia"?: number | null,"creado_en"?: string,"id"?: never,"kg_por_caja"?: number | null,"marca"?: string | null,"nombre"?: string,"precio_referencia"?: number | null,"seleccion"?: string | null,"unidad"?: string,"variedad"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"proveedores": {
                  Row: {
                    "activo": boolean,"alias": (string)[],"contacto": string | null,"creado_en": string,"direccion": string | null,"id": number,"nombre": string,"notas": string | null,"origen": string | null,"ruc": string | null,"telefono": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"alias"?: (string)[],"contacto"?: string | null,"creado_en"?: string,"direccion"?: string | null,"id"?: never,"nombre": string,"notas"?: string | null,"origen"?: string | null,"ruc"?: string | null,"telefono"?: string | null
                  }
                  Update: {
                    "activo"?: boolean,"alias"?: (string)[],"contacto"?: string | null,"creado_en"?: string,"direccion"?: string | null,"id"?: never,"nombre"?: string,"notas"?: string | null,"origen"?: string | null,"ruc"?: string | null,"telefono"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"revisiones_frescura": {
                  Row: {
                    "creado_en": string,"dia": string,"id": number,"llegada_dia": string | null,"llegada_estado": Database["public"]['Enums']["estado_llegada"] | null,"producto_id": number,"registrado_por": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"dia"?: string,"id"?: never,"llegada_dia"?: string | null,"llegada_estado"?: Database["public"]['Enums']["estado_llegada"] | null,"producto_id": number,"registrado_por"?: string
                  }
                  Update: {
                    "creado_en"?: string,"dia"?: string,"id"?: never,"llegada_dia"?: string | null,"llegada_estado"?: Database["public"]['Enums']["estado_llegada"] | null,"producto_id"?: number,"registrado_por"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "revisiones_frescura_producto_id_fkey"
      columns: ["producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "revisiones_frescura_producto_id_fkey"
      columns: ["producto_id"]
isOneToOne: false
      referencedRelation: "v_stock"
      referencedColumns: ["producto_id"]
    },{
      foreignKeyName: "revisiones_frescura_registrado_por_fkey"
      columns: ["registrado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"series_comprobante": {
                  Row: {
                    "serie": string,"tipo": string,"ultimo_numero": number
                  }
                  ComputedFields: never
                  Insert: {
                    "serie": string,"tipo": string,"ultimo_numero"?: number
                  }
                  Update: {
                    "serie"?: string,"tipo"?: string,"ultimo_numero"?: number
                  }
                  Relationships: [
                    
                  ]
                },"suscripciones_push": {
                  Row: {
                    "activa": boolean,"clave_auth": string,"clave_p256dh": string,"creada_en": string,"desactivada_en": string | null,"endpoint": string,"id": number,"ultimo_aviso_en": string | null,"ultimo_error": string | null,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activa"?: boolean,"clave_auth": string,"clave_p256dh": string,"creada_en"?: string,"desactivada_en"?: string | null,"endpoint": string,"id"?: never,"ultimo_aviso_en"?: string | null,"ultimo_error"?: string | null,"usuario_id": string
                  }
                  Update: {
                    "activa"?: boolean,"clave_auth"?: string,"clave_p256dh"?: string,"creada_en"?: string,"desactivada_en"?: string | null,"endpoint"?: string,"id"?: never,"ultimo_aviso_en"?: string | null,"ultimo_error"?: string | null,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "suscripciones_push_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"temperaturas": {
                  Row: {
                    "comando_voz_id": number | null,"creado_en": string,"fecha": string,"grados": number,"id": number,"registrado_por": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comando_voz_id"?: number | null,"creado_en"?: string,"fecha"?: string,"grados": number,"id"?: never,"registrado_por"?: string
                  }
                  Update: {
                    "comando_voz_id"?: number | null,"creado_en"?: string,"fecha"?: string,"grados"?: number,"id"?: never,"registrado_por"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "temperaturas_comando_voz_id_fkey"
      columns: ["comando_voz_id"]
isOneToOne: false
      referencedRelation: "comandos_voz"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "temperaturas_registrado_por_fkey"
      columns: ["registrado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"venta_items": {
                  Row: {
                    "cantidad": number,"descuento": number,"id": number,"precio_unitario": number,"producto_id": number,"subtotal": number | null,"venta_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cantidad": number,"descuento"?: number,"id"?: never,"precio_unitario": number,"producto_id": number,"subtotal"?: never,"venta_id": number
                  }
                  Update: {
                    "cantidad"?: number,"descuento"?: number,"id"?: never,"precio_unitario"?: number,"producto_id"?: number,"subtotal"?: never,"venta_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "venta_items_producto_id_fkey"
      columns: ["producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "venta_items_producto_id_fkey"
      columns: ["producto_id"]
isOneToOne: false
      referencedRelation: "v_stock"
      referencedColumns: ["producto_id"]
    },{
      foreignKeyName: "venta_items_venta_id_fkey"
      columns: ["venta_id"]
isOneToOne: false
      referencedRelation: "ventas"
      referencedColumns: ["id"]
    }
                  ]
                },"ventas": {
                  Row: {
                    "anulada_en": string | null,"anulada_por": string | null,"cliente_id": number | null,"comando_voz_id": number | null,"condicion": Database["public"]['Enums']["condicion_pago"],"creado_en": string,"estado": string,"fecha": string,"id": number,"medio_pago": Database["public"]['Enums']["medio_pago"] | null,"motivo_anulacion": string | null,"registrado_por": string,"total": number
                  }
                  ComputedFields: never
                  Insert: {
                    "anulada_en"?: string | null,"anulada_por"?: string | null,"cliente_id"?: number | null,"comando_voz_id"?: number | null,"condicion": Database["public"]['Enums']["condicion_pago"],"creado_en"?: string,"estado"?: string,"fecha"?: string,"id"?: never,"medio_pago"?: Database["public"]['Enums']["medio_pago"] | null,"motivo_anulacion"?: string | null,"registrado_por"?: string,"total"?: number
                  }
                  Update: {
                    "anulada_en"?: string | null,"anulada_por"?: string | null,"cliente_id"?: number | null,"comando_voz_id"?: number | null,"condicion"?: Database["public"]['Enums']["condicion_pago"],"creado_en"?: string,"estado"?: string,"fecha"?: string,"id"?: never,"medio_pago"?: Database["public"]['Enums']["medio_pago"] | null,"motivo_anulacion"?: string | null,"registrado_por"?: string,"total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "ventas_anulada_por_fkey"
      columns: ["anulada_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ventas_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ventas_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "v_saldo_clientes"
      referencedColumns: ["cliente_id"]
    },{
      foreignKeyName: "ventas_comando_voz_id_fkey"
      columns: ["comando_voz_id"]
isOneToOne: false
      referencedRelation: "comandos_voz"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ventas_registrado_por_fkey"
      columns: ["registrado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"vida_util_estimada": {
                  Row: {
                    "creado_en": string,"dia": string,"dias": number,"id": number,"modelo": string,"motivo": string,"producto_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"dia": string,"dias": number,"id"?: never,"modelo": string,"motivo": string,"producto_id": number
                  }
                  Update: {
                    "creado_en"?: string,"dia"?: string,"dias"?: number,"id"?: never,"modelo"?: string,"motivo"?: string,"producto_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "vida_util_estimada_producto_id_fkey"
      columns: ["producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vida_util_estimada_producto_id_fkey"
      columns: ["producto_id"]
isOneToOne: false
      referencedRelation: "v_stock"
      referencedColumns: ["producto_id"]
    }
                  ]
                }
          }
          Views: {
            "v_mermas_con_stock": {
                  Row: {
                    "cajas": number | null,"fecha": string,"id": number,"producto_id": number,"stock_antes": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "cajas"?: never,"fecha"?: string | null,"id"?: number | null,"producto_id"?: number | null,"stock_antes"?: never
                         }
                        Update: {
                           "cajas"?: never,"fecha"?: string | null,"id"?: number | null,"producto_id"?: number | null,"stock_antes"?: never
                         }
                        Relationships: [
                    {
      foreignKeyName: "movimientos_stock_producto_id_fkey"
      columns: ["producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "movimientos_stock_producto_id_fkey"
      columns: ["producto_id"]
isOneToOne: false
      referencedRelation: "v_stock"
      referencedColumns: ["producto_id"]
    }
                  ]
                },"v_saldo_clientes": {
                  Row: {
                    "alias": (string)[],"cliente_id": number,"nombre": string,"saldo": number | null,"ultima_venta_credito": string | null,"ultimo_abono": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_saldo_proveedores": {
                  Row: {
                    "activo": boolean,"alias": (string)[],"nombre": string,"proveedor_id": number,"saldo": number | null,"ultima_compra_credito": string | null,"ultimo_pago": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_stock": {
                  Row: {
                    "calibre": string | null,"marca": string | null,"nombre": string,"producto_id": number,"seleccion": string | null,"stock": number | null,"unidad": string,"variedad": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_temperatura_dia": {
                  Row: {
                    "dia": string | null,"fecha": string,"grados": number
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_vida_util": {
                  Row: {
                    "creado_en": string,"dia": string,"dias": number,"modelo": string,"motivo": string,"producto_id": number
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "vida_util_estimada_producto_id_fkey"
      columns: ["producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vida_util_estimada_producto_id_fkey"
      columns: ["producto_id"]
isOneToOne: false
      referencedRelation: "v_stock"
      referencedColumns: ["producto_id"]
    }
                  ]
                }
          }
          Functions: {
            "anular_venta":
{ Args: { "p_motivo": string,"p_venta_id": number }; Returns: undefined
                           },
"buscar_clientes":
{ Args: { "limite"?: number,"q": string }; Returns: {
              "alias": (string)[],"id": number,"nombre": string,"similitud": number
            }[]
                           },
"buscar_productos":
{ Args: { "limite"?: number,"q": string }; Returns: {
              "calibre": string,"id": number,"marca": string,"nombre": string,"seleccion": string,"similitud": number,"variedad": string
            }[]
                           },
"comando_propio":
{ Args: { "p_comando_voz_id": number }; Returns: boolean
                           },
"compras_por_proveedor":
{ Args: { "p_desde": string }; Returns: {
              "cajas": number,"compras": number,"costo_promedio": number,"producto_id": number,"proveedor_id": number,"total": number,"ultima": string,"ultimo_costo": number
            }[]
                           },
"fecha_del_celular":
{ Args: { "p": string }; Returns: string
                           },
"registrar_compra":
{ Args: { "p": Json }; Returns: number
                           },
"registrar_venta":
{ Args: { "p": Json }; Returns: number
                           },
"reservar_comprobante":
{ Args: { "p_tipo": string,"p_venta_id": number }; Returns: Json
                           },
"resumen_dia":
{ Args: { "p_fecha"?: string }; Returns: Json
                           },
"rol_actual":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["rol_usuario"]
                           },
"tomar_frase":
{ Args: { "p_celular": string,"p_frase": string }; Returns: boolean
                           },
"tomar_numero":
{ Args: { "p_serie": string }; Returns: number
                           },
"ultimo_precio":
{ Args: { "p_cliente_id": number,"p_producto_id": number }; Returns: number
                           }
          }
          Enums: {
            "condicion_pago": "contado"|"credito","estado_comprobante": "pendiente"|"enviado"|"aceptado"|"rechazado"|"anulado","estado_llegada": "verde"|"pinton"|"maduro","medio_pago": "efectivo"|"yape"|"plin"|"transferencia"|"otro","rol_usuario": "duenio"|"administrador"|"ayudante"|"contador","tipo_movimiento": "entrada_compra"|"salida_venta"|"merma"|"ajuste"|"devolucion"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "condicion_pago": ["contado", "credito"],"estado_comprobante": ["pendiente", "enviado", "aceptado", "rechazado", "anulado"],"estado_llegada": ["verde", "pinton", "maduro"],"medio_pago": ["efectivo", "yape", "plin", "transferencia", "otro"],"rol_usuario": ["duenio", "administrador", "ayudante", "contador"],"tipo_movimiento": ["entrada_compra", "salida_venta", "merma", "ajuste", "devolucion"]
          }
        }
} as const
