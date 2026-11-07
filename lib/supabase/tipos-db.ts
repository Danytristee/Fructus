
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "abonos": {
                  Row: {
                    "cliente_id": number,"comando_voz_id": number | null,"fecha": string,"id": number,"medio_pago": Database["public"]['Enums']["medio_pago"],"monto": number,"nota": string | null,"registrado_por": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cliente_id": number,"comando_voz_id"?: number | null,"fecha"?: string,"id"?: never,"medio_pago": Database["public"]['Enums']["medio_pago"],"monto": number,"nota"?: string | null,"registrado_por"?: string
                  }
                  Update: {
                    "cliente_id"?: number,"comando_voz_id"?: number | null,"fecha"?: string,"id"?: never,"medio_pago"?: Database["public"]['Enums']["medio_pago"],"monto"?: number,"nota"?: string | null,"registrado_por"?: string
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
                    "creado_en": string,"duracion_audio_ms": number | null,"id": number,"intencion": string | null,"interpretacion": Json | null,"latencia_ms": number | null,"modelo_llm": string | null,"modelo_stt": string | null,"registrado_por": string,"resultado": string,"transcripcion": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"duracion_audio_ms"?: number | null,"id"?: never,"intencion"?: string | null,"interpretacion"?: Json | null,"latencia_ms"?: number | null,"modelo_llm"?: string | null,"modelo_stt"?: string | null,"registrado_por"?: string,"resultado"?: string,"transcripcion": string
                  }
                  Update: {
                    "creado_en"?: string,"duracion_audio_ms"?: number | null,"id"?: never,"intencion"?: string | null,"interpretacion"?: Json | null,"latencia_ms"?: number | null,"modelo_llm"?: string | null,"modelo_stt"?: string | null,"registrado_por"?: string,"resultado"?: string,"transcripcion"?: string
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
                    "cantidad": number,"comando_voz_id": number | null,"compra_id": number | null,"fecha": string,"id": number,"motivo": string | null,"producto_id": number,"registrado_por": string,"tipo": Database["public"]['Enums']["tipo_movimiento"],"venta_id": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cantidad": number,"comando_voz_id"?: number | null,"compra_id"?: number | null,"fecha"?: string,"id"?: never,"motivo"?: string | null,"producto_id": number,"registrado_por"?: string,"tipo": Database["public"]['Enums']["tipo_movimiento"],"venta_id"?: number | null
                  }
                  Update: {
                    "cantidad"?: number,"comando_voz_id"?: number | null,"compra_id"?: number | null,"fecha"?: string,"id"?: never,"motivo"?: string | null,"producto_id"?: number,"registrado_por"?: string,"tipo"?: Database["public"]['Enums']["tipo_movimiento"],"venta_id"?: number | null
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
                    "activo": boolean,"afectacion_igv": string,"alias": (string)[],"creado_en": string,"id": number,"nombre": string,"precio_referencia": number | null,"unidad": string,"variedad": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"afectacion_igv"?: string,"alias"?: (string)[],"creado_en"?: string,"id"?: never,"nombre": string,"precio_referencia"?: number | null,"unidad"?: string,"variedad"?: string | null
                  }
                  Update: {
                    "activo"?: boolean,"afectacion_igv"?: string,"alias"?: (string)[],"creado_en"?: string,"id"?: never,"nombre"?: string,"precio_referencia"?: number | null,"unidad"?: string,"variedad"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"proveedores": {
                  Row: {
                    "activo": boolean,"alias": (string)[],"creado_en": string,"id": number,"nombre": string,"ruc": string | null,"telefono": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"alias"?: (string)[],"creado_en"?: string,"id"?: never,"nombre": string,"ruc"?: string | null,"telefono"?: string | null
                  }
                  Update: {
                    "activo"?: boolean,"alias"?: (string)[],"creado_en"?: string,"id"?: never,"nombre"?: string,"ruc"?: string | null,"telefono"?: string | null
                  }
                  Relationships: [
                    
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
                }
          }
          Views: {
            "v_saldo_clientes": {
                  Row: {
                    "alias": (string)[],"cliente_id": number,"nombre": string,"saldo": number | null,"ultima_venta_credito": string | null,"ultimo_abono": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_stock": {
                  Row: {
                    "nombre": string,"producto_id": number,"stock": number | null,"unidad": string,"variedad": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
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
              "id": number,"nombre": string,"similitud": number,"variedad": string
            }[]
                           },
"registrar_compra":
{ Args: { "p": Json }; Returns: number
                           },
"registrar_venta":
{ Args: { "p": Json }; Returns: number
                           },
"resumen_dia":
{ Args: { "p_fecha"?: string }; Returns: Json
                           },
"rol_actual":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["rol_usuario"]
                           },
"tomar_numero":
{ Args: { "p_serie": string }; Returns: number
                           },
"ultimo_precio":
{ Args: { "p_cliente_id": number,"p_producto_id": number }; Returns: number
                           }
          }
          Enums: {
            "condicion_pago": "contado"|"credito","estado_comprobante": "pendiente"|"enviado"|"aceptado"|"rechazado"|"anulado","medio_pago": "efectivo"|"yape"|"plin"|"transferencia"|"otro","rol_usuario": "duenio"|"administrador"|"ayudante"|"contador","tipo_movimiento": "entrada_compra"|"salida_venta"|"merma"|"ajuste"|"devolucion"
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
            "condicion_pago": ["contado", "credito"],"estado_comprobante": ["pendiente", "enviado", "aceptado", "rechazado", "anulado"],"medio_pago": ["efectivo", "yape", "plin", "transferencia", "otro"],"rol_usuario": ["duenio", "administrador", "ayudante", "contador"],"tipo_movimiento": ["entrada_compra", "salida_venta", "merma", "ajuste", "devolucion"]
          }
        }
} as const
