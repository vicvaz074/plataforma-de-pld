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
]
