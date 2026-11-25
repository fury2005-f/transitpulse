# ALL DATA IS SYNTHETIC — this is a method demonstration.
from types import SimpleNamespace

import pytest
from google.genai import errors as genai_errors

from agent import loop


class FakeModels:
    def __init__(self, busy: set[str], gone: set[str], bad: set[str]):
        self.busy, self.gone, self.bad, self.calls = busy, gone, bad, []

    def generate_content(self, model, contents, config):
        self.calls.append(model)
        if model in self.busy:
            raise genai_errors.ServerError(503, {"error": {"message": "high demand", "status": "UNAVAILABLE"}})
        if model in self.gone:
            raise genai_errors.ClientError(404, {"error": {"message": "no longer available", "status": "NOT_FOUND"}})
        if model in self.bad:
            raise genai_errors.ClientError(400, {"error": {"message": "bad request", "status": "INVALID_ARGUMENT"}})
        return f"answer from {model}"


@pytest.fixture
def fake(monkeypatch):
    def install(busy=(), gone=(), bad=()):
        models = FakeModels(set(busy), set(gone), set(bad))
        monkeypatch.setattr(loop, "client", lambda: SimpleNamespace(models=models))
        monkeypatch.setattr(loop.time, "sleep", lambda s: None)
        monkeypatch.setattr(loop, "_cooling", {})
        monkeypatch.setattr(loop, "_last_good", None)
        return models
    return install


M = loop.MODELS


def test_busy_models_get_one_retry_then_fall_through(fake):
    models = fake(busy=M[:2])
    model, reply = loop.generate("q")
    assert model == M[2] and reply == f"answer from {M[2]}"
    assert models.calls == [M[0], M[0], M[1], M[1], M[2]]


def test_retired_model_is_skipped_without_retry(fake):
    # the bug seen live: a 404 from a retired model stopped the whole chain
    models = fake(busy=[M[0]], gone=[M[1]])
    model, _ = loop.generate("q")
    assert model == M[2]
    assert models.calls == [M[0], M[0], M[1], M[2]]


def test_last_working_model_is_tried_first(fake):
    models = fake(busy=[M[0]])
    loop.generate("step 1")
    models.busy.clear()  # even after the main model recovers, stay on the one that answered
    models.calls.clear()
    loop.generate("step 2")
    assert models.calls == [M[1]]


def test_other_errors_are_not_hidden(fake):
    fake(bad=[M[0]])
    with pytest.raises(genai_errors.ClientError):
        loop.generate("q")


def test_all_busy_raises_server_error(fake):
    fake(busy=M)
    with pytest.raises(genai_errors.ServerError):
        loop.generate("q")
