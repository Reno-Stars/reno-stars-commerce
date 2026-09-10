"use client"
import { useState } from "react"
import ProductModelViewer from "@/modules/products/components/product-model-viewer"
import { HttpTypes } from "@medusajs/types"
export default function Test() {
 const [mode,setMode]=useState("cabinet")
 const metadata=mode==='none'?{}:mode==='generic'?{model_url:'/cabinet-library/models/PLY-WSS-W2430.glb',model_family:'wall'}:{cabinet_library_sku:'PLY-WSS-SB30',width_mm:762,height_mm:762,depth_mm:606.425}
 return <><button onClick={()=>setMode('cabinet')}>Cabinet fixture</button><button onClick={()=>setMode('generic')}>Generic fixture</button><button onClick={()=>setMode('none')}>No model fixture</button><ProductModelViewer product={{id:mode,title:'White Single Shaker Cabinet',metadata} as unknown as HttpTypes.StoreProduct}/></>
}
