import { Link } from "react-router-dom";
import BufferGate from "../../components/BufferGate";
import PageHeader from "../../components/PageHeader";
import PostsBrowser from "../../components/PostsBrowser";
import SyncButton from "../../components/SyncButton";

export default function PostsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Posts"
        title="Every post, by status"
        subtitle="Queue, drafts, overdue drafts, needs approval and sent. Filter by organization and channel"
        actions={
          <>
            <SyncButton />
            <Link className="btn btn-primary" to="/create">
              New post
            </Link>
          </>
        }
      />
      <BufferGate>
        {({ overview }) => (
          <PostsBrowser organizations={overview.organizations} />
        )}
      </BufferGate>
    </>
  );
}
