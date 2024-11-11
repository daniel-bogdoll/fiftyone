"""
Execution store repository.

| Copyright 2017-2024, Voxel51, Inc.
| `voxel51.com <https://voxel51.com/>`_
|
"""

from datetime import datetime

from bson import ObjectId
from pymongo.collection import Collection

from fiftyone.operators.store.models import StoreDocument, KeyDocument


class ExecutionStoreRepo(object):
    """Base class for execution store repositories.

    Each instance of this repository has a context:

    -   If a ``dataset_id`` is provided, it operates on stores associated with
        that dataset
    -   If no ``dataset_id`` is provided, it operates on stores that are not
        associated with a dataset

    To operate on all stores across all contexts, use the ``XXX_global()``
    methods that this class provides.
    """

    COLLECTION_NAME = "execution_store"

    def __init__(self, collection: Collection, dataset_id: ObjectId = None):
        self._collection = collection
        self._dataset_id = dataset_id

    def create_store(self, store_name) -> StoreDocument:
        """Creates a store associated with the current context."""
        store_doc = StoreDocument(
            store_name=store_name,
            dataset_id=self._dataset_id,
        )
        self._collection.insert_one(store_doc.to_mongo_dict())
        return store_doc

    def has_store(self, store_name):
        """Checks whether a store with the given name exists in the current
        context.
        """
        result = self._collection.find_one(
            dict(
                store_name=store_name,
                key="__store__",
                dataset_id=self._dataset_id,
            ),
            {},
        )
        return bool(result)

    def list_stores(self) -> list[str]:
        """Lists the stores associated with the current context."""
        result = self._collection.find(
            dict(key="__store__", dataset_id=self._dataset_id),
            {"store_name": 1},
        )
        return [d["store_name"] for d in result]

    def count_stores(self) -> int:
        """Counts the stores associated with the current context."""
        return self._collection.count_documents(
            dict(key="__store__", dataset_id=self._dataset_id),
        )

    def delete_store(self, store_name) -> int:
        """Deletes the specified store."""
        result = self._collection.delete_many(
            dict(store_name=store_name, dataset_id=self._dataset_id)
        )
        return result.deleted_count

    def set_key(self, store_name, key, value, ttl=None) -> KeyDocument:
        """Sets or updates a key in the specified store."""
        now = datetime.utcnow()
        expiration = KeyDocument.get_expiration(ttl)

        key_doc = KeyDocument(
            store_name=store_name,
            key=key,
            value=value,
            updated_at=now,
            expires_at=expiration,
            dataset_id=self._dataset_id,
        )

        on_insert_fields = {
            "store_name": store_name,
            "key": key,
            "created_at": now,
            "expires_at": expiration if ttl else None,
            "dataset_id": self._dataset_id,
        }

        if self._dataset_id is None:
            on_insert_fields.pop("dataset_id")

        # Prepare the update operations
        update_fields = {
            "$set": {
                k: v
                for k, v in key_doc.to_mongo_dict().items()
                if k
                not in {
                    "_id",
                    "created_at",
                    "expires_at",
                    "store_name",
                    "key",
                    "dataset_id",
                }
            },
            "$setOnInsert": on_insert_fields,
        }

        # Perform the upsert operation
        result = self._collection.update_one(
            dict(store_name=store_name, key=key, dataset_id=self._dataset_id),
            update_fields,
            upsert=True,
        )

        if result.upserted_id:
            key_doc.created_at = now
        else:
            key_doc.updated_at = now

        return key_doc

    def get_key(self, store_name, key) -> KeyDocument:
        """Gets a key from the specified store."""
        raw_key_doc = self._collection.find_one(
            dict(store_name=store_name, key=key, dataset_id=self._dataset_id)
        )
        key_doc = KeyDocument(**raw_key_doc) if raw_key_doc else None
        return key_doc

    def update_ttl(self, store_name, key, ttl) -> bool:
        """Updates the TTL for a key."""
        expiration = KeyDocument.get_expiration(ttl)
        result = self._collection.update_one(
            dict(store_name=store_name, key=key, dataset_id=self._dataset_id),
            {"$set": {"expires_at": expiration}},
        )
        return result.modified_count > 0

    def delete_key(self, store_name, key) -> bool:
        """Deletes the document that matches the store name and key, if one
        exists.
        """
        result = self._collection.delete_one(
            dict(store_name=store_name, key=key, dataset_id=self._dataset_id)
        )
        return result.deleted_count > 0

    def list_keys(self, store_name) -> list[str]:
        """Lists all keys in the specified store."""
        result = self._collection.find(
            dict(
                store_name=store_name,
                key={"$ne": "__store__"},
                dataset_id=self._dataset_id,
            ),
            {"key": 1},
        )
        return [d["key"] for d in result]

    def count_keys(self, store_name) -> int:
        """Counts the keys in the specified store."""
        return self._collection.count_documents(
            dict(
                store_name=store_name,
                key={"$ne": "__store__"},
                dataset_id=self._dataset_id,
            )
        )

    def cleanup(self) -> int:
        """Deletes all stores and keys associated with the current context."""
        result = self._collection.delete_many(
            dict(dataset_id=self._dataset_id)
        )
        return result.deleted_count

    def has_store_global(self, store_name):
        """Determines whether a store with the given name exists across all
        datasets and the global context.
        """
        result = self._collection.find_one(
            dict(store_name=store_name, key="__store__"), {}
        )
        return bool(result)

    def list_stores_global(self) -> list[str]:
        """Lists the stores in the execution store across all datasets and the
        global context.
        """
        result = self._collection.find(
            dict(key="__store__"), {"store_name": 1}
        )
        return [d["store_name"] for d in result]

    def count_stores_global(self) -> int:
        """Counts the stores in the execution store across all datasets and the
        global context.
        """
        return self._collection.count_documents(dict(key="__store__"))


class MongoExecutionStoreRepo(ExecutionStoreRepo):
    """MongoDB implementation of execution store repository."""

    def __init__(self, collection: Collection, dataset_id: ObjectId = None):
        super().__init__(collection, dataset_id)
        self._create_indexes()

    def _create_indexes(self):
        indices = [idx["name"] for idx in self._collection.list_indexes()]
        expires_at_name = "expires_at"
        store_name_name = "store_name"
        key_name = "key"
        full_key_name = "unique_store_index"
        dataset_id_name = "dataset_id"
        if expires_at_name not in indices:
            self._collection.create_index(
                expires_at_name, name=expires_at_name, expireAfterSeconds=0
            )
        if full_key_name not in indices:
            self._collection.create_index(
                [(store_name_name, 1), (key_name, 1), (dataset_id_name, 1)],
                name=full_key_name,
                unique=True,
            )
        for name in [store_name_name, key_name, dataset_id_name]:
            if name not in indices:
                self._collection.create_index(name, name=name)
