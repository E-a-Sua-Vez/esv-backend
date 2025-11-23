###################
# BUILD FOR LOCAL DEVELOPMENT
###################

FROM node:20-alpine AS development

# Create app directory
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure copying both package.json AND package-lock.json (when available).
# Copying this first prevents re-running npm install on every code change.
COPY --chown=node:node package*.json ./

# Install app dependencies using the `npm ci` command instead of `npm install`
# Using BuildKit cache mount for faster npm installs
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

# Bundle app source
COPY --chown=node:node . .

# Use the node user from the image (instead of the root user)
USER node

###################
# BUILD FOR PRODUCTION
###################

FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY --chown=node:node package*.json ./

# Install all dependencies (including dev) needed for building
# Using BuildKit cache mount for faster npm installs
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

# Copy source code
COPY --chown=node:node . .

# Run the build command which creates the production bundle
RUN npm run build

# Set NODE_ENV environment variable
ENV NODE_ENV production

# Install only production dependencies and clean up
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production --legacy-peer-deps && \
    npm cache clean --force && \
    # Remove unnecessary files from node_modules to reduce size
    find node_modules -type d \( -name "test" -o -name "tests" -o -name "__tests__" -o -name "docs" -o -name "doc" \) -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -type f \( -name "*.md" -o -name "*.map" -o -name "CHANGELOG*" -o -name "LICENSE*" -o -name "README*" \) -delete 2>/dev/null || true && \
    find node_modules -type f -name "*.ts" ! -name "*.d.ts" -delete 2>/dev/null || true && \
    rm -rf node_modules/.cache 2>/dev/null || true

USER node

###################
# PRODUCTION
###################

FROM node:20-alpine AS production

WORKDIR /usr/src/app

# Copy only production dependencies and built code
COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=build /usr/src/app/dist ./dist
COPY --chown=node:node --from=build /usr/src/app/package*.json ./

# Expose port 8080 for Cloud Run
EXPOSE 8080

# Start the server using the production build
CMD [ "node", "dist/main.js" ]

