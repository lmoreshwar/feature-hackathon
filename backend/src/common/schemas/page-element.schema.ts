import { HydratedDocument, InferSchemaType, Schema } from 'mongoose';

export const PAGE_ELEMENT_MODEL_NAME = 'PageElement';

export const PageElementSchema = new Schema(
  {
    featureId: { type: String, required: true, index: true, trim: true },
    testSuiteId: { type: String, default: null, index: true, trim: true },

    pageUrl: { type: String, required: true, trim: true },
    pageName: { type: String, default: null, trim: true },

    elementName: { type: String, required: true, trim: true },

    elementType: {
      type: String,
      enum: ['BUTTON', 'INPUT', 'LINK', 'DROPDOWN', 'CHECKBOX', 'TEXT', 'OTHER'],
      default: 'OTHER',
      required: true,
    },

    selector: { type: String, required: true, trim: true },
    selectorType: {
      type: String,
      enum: ['ID', 'CSS', 'XPATH', 'TEXT'],
      default: 'CSS',
      required: true,
    },

    isStable: { type: Boolean, default: true },

    createdBy: { type: String, required: true, trim: true },

    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { collection: 'pageElements', versionKey: false },
);

export type PageElement = InferSchemaType<typeof PageElementSchema>;
export type PageElementDocument = HydratedDocument<PageElement>;
