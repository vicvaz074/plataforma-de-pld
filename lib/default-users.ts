export interface DefaultUser {
  name: string
  email: string
  password: string
  role: string
  approved: boolean
}

export const DEFAULT_USERS: DefaultUser[] = [
  {
    name: "Gregorio Barco Vega",
    email: "gbarco@davara.com.mx",
    password: "$2b$10$tegxHIzg5yhhq5THDwxA1ewZMnRTurp.Pa0MVHp2sOfcG/Oz95rCm",
    role: "user",
    approved: true,
  },
  {
    name: "Gabriel López",
    email: "glopez@davara.com.mx",
    password: "$2b$10$tegxHIzg5yhhq5THDwxA1ewZMnRTurp.Pa0MVHp2sOfcG/Oz95rCm",
    role: "user",
    approved: true,
  },
  {
    name: "Alexis Cervantes Padilla",
    email: "acervantes@davara.com.mx",
    password: "$2b$10$rqjB7jwBWh/vPuzg7HapWOrc3aEs.Ef8XBVYHI8eR5tDureIrdLYe",
    role: "user",
    approved: true,
  },
  {
    name: "David Casero",
    email: "info@haikulabs.es",
    password: "$2b$10$aJXnwJTq1I70Jcj2LLm0.O/oEsNV3IVryBBmqMrD8jx0zdsDH24Eu",
    role: "user",
    approved: true,
  },
]
