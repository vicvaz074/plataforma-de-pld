"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import type { ThirdPartySource } from "./third-party"
import type { ExternalRecipient } from "./external-recipients"
import type { ProcessingActivity } from "./data"
import type { Document } from "./documents"

interface AppState {
  thirdPartySources: ThirdPartySource[]
  externalRecipients: ExternalRecipient[]
  processingActivities: ProcessingActivity[]
  documents: Document[]
  templates: any[]
  activitiesUnderReview: ProcessingActivity[]
}

interface AppContextType {
  state: AppState
  updateThirdPartySource: (updatedSource: ThirdPartySource) => void
  deleteThirdPartySource: (id: string) => void
  updateExternalRecipient: (updatedRecipient: ExternalRecipient) => void
  deleteExternalRecipient: (id: string) => void
  updateProcessingActivity: (updatedActivity: ProcessingActivity) => void
  deleteProcessingActivity: (id: number) => void
  updateDocument: (updatedDocument: Document) => void
  deleteDocument: (id: string) => void
  addTemplate: (template: any) => void
  updateTemplate: (updatedTemplate: any) => void
  deleteTemplate: (id: number) => void
  addActivityUnderReview: (activity: ProcessingActivity) => void
  approveActivity: (activity: ProcessingActivity) => void
  rejectActivity: (activity: ProcessingActivity) => void
  deleteActivityUnderReview: (id: number) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    thirdPartySources: [],
    externalRecipients: [],
    processingActivities: [],
    documents: [],
    templates: [],
    activitiesUnderReview: [],
  })

  useEffect(() => {
    const savedState = localStorage.getItem("appState")
    if (savedState) {
      setState(JSON.parse(savedState))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("appState", JSON.stringify(state))
  }, [state])

  const updateThirdPartySource = (updatedSource: ThirdPartySource) => {
    setState((prevState) => ({
      ...prevState,
      thirdPartySources: prevState.thirdPartySources.map((source) =>
        source.id === updatedSource.id ? updatedSource : source,
      ),
    }))
  }

  const deleteThirdPartySource = (id: string) => {
    setState((prevState) => ({
      ...prevState,
      thirdPartySources: prevState.thirdPartySources.filter((source) => source.id !== id),
    }))
  }

  const updateExternalRecipient = (updatedRecipient: ExternalRecipient) => {
    setState((prevState) => ({
      ...prevState,
      externalRecipients: prevState.externalRecipients.map((recipient) =>
        recipient.id === updatedRecipient.id ? updatedRecipient : recipient,
      ),
    }))
  }

  const deleteExternalRecipient = (id: string) => {
    setState((prevState) => ({
      ...prevState,
      externalRecipients: prevState.externalRecipients.filter((recipient) => recipient.id !== id),
    }))
  }

  const updateProcessingActivity = (updatedActivity: ProcessingActivity) => {
    setState((prevState) => ({
      ...prevState,
      processingActivities: prevState.processingActivities.map((activity) =>
        activity.id === updatedActivity.id ? updatedActivity : activity,
      ),
    }))
  }

  const deleteProcessingActivity = (id: number) => {
    setState((prevState) => ({
      ...prevState,
      processingActivities: prevState.processingActivities.filter((activity) => activity.id !== id),
    }))
  }

  const updateDocument = (updatedDocument: Document) => {
    setState((prevState) => ({
      ...prevState,
      documents: prevState.documents.map((doc) => (doc.id === updatedDocument.id ? updatedDocument : doc)),
    }))
  }

  const deleteDocument = (id: string) => {
    setState((prevState) => ({
      ...prevState,
      documents: prevState.documents.filter((doc) => doc.id !== id),
    }))
  }

  const addTemplate = (template: any) => {
    setState((prevState) => ({
      ...prevState,
      templates: [...prevState.templates, { ...template, id: Date.now() }],
    }))
  }

  const updateTemplate = (updatedTemplate: any) => {
    setState((prevState) => ({
      ...prevState,
      templates: prevState.templates.map((template) =>
        template.id === updatedTemplate.id ? updatedTemplate : template,
      ),
    }))
  }

  const deleteTemplate = (id: number) => {
    setState((prevState) => ({
      ...prevState,
      templates: prevState.templates.map((template) =>
        template.id === id ? { ...template, deleted: true } : template,
      ),
    }))
  }

  const addActivityUnderReview = (activity: ProcessingActivity) => {
    setState((prevState) => ({
      ...prevState,
      activitiesUnderReview: [...prevState.activitiesUnderReview, activity],
    }))
  }

  const approveActivity = (activity: ProcessingActivity) => {
    setState((prevState) => ({
      ...prevState,
      activitiesUnderReview: prevState.activitiesUnderReview.filter((a) => a.id !== activity.id),
      processingActivities: [...prevState.processingActivities, { ...activity, status: "Approved" }],
    }))
  }

  const rejectActivity = (activity: ProcessingActivity) => {
    setState((prevState) => ({
      ...prevState,
      activitiesUnderReview: prevState.activitiesUnderReview.map((a) =>
        a.id === activity.id ? { ...a, status: "Rejected" } : a,
      ),
    }))
  }

  const deleteActivityUnderReview = (id: number) => {
    setState((prevState) => ({
      ...prevState,
      activitiesUnderReview: prevState.activitiesUnderReview.filter((activity) => activity.id !== id),
    }))
  }

  return (
    <AppContext.Provider
      value={{
        state,
        updateThirdPartySource,
        deleteThirdPartySource,
        updateExternalRecipient,
        deleteExternalRecipient,
        updateProcessingActivity,
        deleteProcessingActivity,
        updateDocument,
        deleteDocument,
        addTemplate,
        updateTemplate,
        deleteTemplate,
        addActivityUnderReview,
        approveActivity,
        rejectActivity,
        deleteActivityUnderReview,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useAppContext = () => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider")
  }
  return context
}
