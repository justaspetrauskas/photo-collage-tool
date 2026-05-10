import fs from 'node:fs';

const key = process.env.LINEAR_API_KEY;
const projectId = process.env.LINEAR_PROJECT_ID ?? '9c384e35-e5b8-4e68-a08d-826879e5ffb5';
const bodyPath = process.env.LINEAR_UPDATE_BODY_PATH ?? '/tmp/collag-io-update.md';

if (!key) {
  console.error('Missing LINEAR_API_KEY');
  process.exit(1);
}

if (!fs.existsSync(bodyPath)) {
  console.error(`Update body file not found: ${bodyPath}`);
  process.exit(1);
}

const body = fs.readFileSync(bodyPath, 'utf8');
const endpoint = 'https://api.linear.app/graphql';

async function gql(query, variables) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: key,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors.map((e) => e.message).join(' | '));
  }
  return json.data;
}

async function main() {
  const createMutation = `
    mutation CreateProjectUpdate($input: ProjectUpdateCreateInput!) {
      projectUpdateCreate(input: $input) {
        success
        projectUpdate {
          id
          createdAt
          health
          body
        }
      }
    }
  `;

  const created = await gql(createMutation, {
    input: {
      projectId,
      body,
    },
  });

  if (!created.projectUpdateCreate?.success) {
    throw new Error('projectUpdateCreate returned success=false');
  }

  const update = created.projectUpdateCreate.projectUpdate;

  const verifyQuery = `
    query GetProjectLatestUpdate($id: String!) {
      project(id: $id) {
        id
        name
        projectUpdates(first: 1) {
          nodes {
            id
            createdAt
            health
            body
          }
        }
      }
    }
  `;

  const verified = await gql(verifyQuery, { id: projectId });
  const latest = verified.project.projectUpdates.nodes[0];

  console.log(`Created update: ${update.id}`);
  console.log(`Created at: ${update.createdAt}`);
  console.log(`Health: ${update.health ?? 'not-set'}`);
  console.log(`Latest in ${verified.project.name}: ${latest.id}`);
  console.log('Preview:');
  console.log((latest.body || '').split('\n').slice(0, 8).join('\n'));
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
