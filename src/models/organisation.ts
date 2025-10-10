import mongoose from 'mongoose'
import { UserSchemaType } from './user'

export interface OrganisationSchemaType {
  owner: mongoose.Schema.Types.ObjectId
  name: string
  hobbies: string[]
  coWorkers: mongoose.Schema.Types.ObjectId[] & UserSchemaType[]
  generateJoinLink: () => string
  joinLink: string
  url: string
}

const organisationSchema = new mongoose.Schema<OrganisationSchemaType>(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    name: {
      type: String,
    },
    coWorkers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    joinLink: String,
    url: String,
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

// Generate organisation join link
organisationSchema.methods.generateJoinLink = function () {
  const url = process.env.CLIENT_URL || 'http://localhost:3000'
  this.joinLink = `${url}/${this._id}`
  this.url = `${url}/${this.name}`
}

export default mongoose.model('Organisation', organisationSchema)
