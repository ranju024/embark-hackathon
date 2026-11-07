from rest_framework.throttling import SimpleRateThrottle


class ChatRateThrottle(SimpleRateThrottle):
    """
    Tighter limit just for the AI chat endpoint, since every call hits an
    external API. Keyed by user id when logged in, otherwise by IP.
    """
    scope = "chat"
    rate = "12/min"

    def get_cache_key(self, request, view):
        ident = request.user.pk if request.user.is_authenticated else self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}