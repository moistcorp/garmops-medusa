import { Module } from "@medusajs/framework/utils"
import GarmopsModuleService from "./service"

export const GARMOPS_MODULE = "garmops"
export default Module(GARMOPS_MODULE, { service: GarmopsModuleService })
